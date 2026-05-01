//! Tauri command bridge to `twinpics_core` (stable UI contract via `invoke`).

use std::path::Path;
use std::sync::Arc;
use std::sync::Mutex;

use twinpics_core::ml::{CandleClipBackend, EmbeddingBackend};
use tauri::Emitter;
use twinpics_core::{
    index_folder, list_projects, list_tag_counts, project_artefact_paths, project_paths_for_source,
    search_project_image, search_project_text, IndexOptions, IndexProgress, Manifest, ProgressCallback,
    ProjectConfig, SearchParams,
};

/// Progress payload for the `twinpics://index-progress` event (align with frontend `IndexProgressEvent`).
#[derive(serde::Serialize, Clone, Debug)]
#[serde(tag = "kind")]
enum IndexProgressEventDto {
    #[serde(rename = "scanning")]
    Scanning,
    #[serde(rename = "discovered")]
    Discovered {
        total: usize,
        #[serde(rename = "scanMs")]
        scan_ms: u64,
    },
    #[serde(rename = "fileFinished")]
    FileFinished {
        index: usize,
        total: usize,
        path: String,
        #[serde(rename = "elapsedMs")]
        elapsed_ms: u64,
        #[serde(rename = "avgMs")]
        avg_ms: f64,
        #[serde(rename = "etaMs")]
        eta_ms: u64,
    },
    #[serde(rename = "finishing")]
    Finishing,
    #[serde(rename = "done")]
    Done,
}

fn index_progress_to_event(ev: &IndexProgress) -> Option<IndexProgressEventDto> {
    match ev {
        IndexProgress::Scanning => Some(IndexProgressEventDto::Scanning),
        IndexProgress::Discovered { total, scan_ms } => Some(IndexProgressEventDto::Discovered {
            total: *total,
            scan_ms: *scan_ms,
        }),
        IndexProgress::FileFinished {
            index,
            total,
            path,
            elapsed_ms,
            avg_ms,
            eta_ms,
        } => Some(IndexProgressEventDto::FileFinished {
            index: *index,
            total: *total,
            path: path.to_string_lossy().to_string(),
            elapsed_ms: *elapsed_ms,
            avg_ms: *avg_ms,
            eta_ms: *eta_ms,
        }),
        IndexProgress::Finishing => Some(IndexProgressEventDto::Finishing),
        IndexProgress::Done => Some(IndexProgressEventDto::Done),
        _ => None,
    }
}

/// Shared, lazily-initialised CLIP backend (same life as the app process).
pub struct ClipState {
    inner: Mutex<Option<Arc<dyn EmbeddingBackend + Send + Sync>>>,
}

impl Default for ClipState {
    fn default() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }
}

impl ClipState {
    fn backend(&self) -> Result<Arc<dyn EmbeddingBackend + Send + Sync>, String> {
        let mut g = self.inner.lock().map_err(|e| e.to_string())?;
        if g.is_none() {
            let b: Arc<dyn EmbeddingBackend + Send + Sync> =
                Arc::new(CandleClipBackend::new().map_err(|e| e.to_string())?);
            *g = Some(b.clone());
            Ok(b)
        } else {
            Ok(g.as_ref().unwrap().clone())
        }
    }
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IndexSummary {
    pub source_path: String,
    pub file_count: usize,
    pub created_at: String,
    pub project_path: String,
    /// Paths written for this index (e.g. `index.usearch`, `manifest.json`, `config.json`, `tags.sqlite`).
    pub artefacts: Vec<String>,
    /// Milliseconds to scan the source tree; `0` for [`list_indices`] (not recorded).
    pub scan_duration_ms: u64,
    /// Per-image phase; `0` for [`list_indices`].
    pub process_duration_ms: u64,
    /// Build index and write project files; `0` for [`list_indices`].
    pub finalize_duration_ms: u64,
    /// Wall time for the last index run; `0` for [`list_indices`].
    pub index_duration_ms: u64,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHitDto {
    pub rank: usize,
    pub score: f32,
    pub path: String,
    /// 0-based page index for PDF hits; omitted for regular images.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pdf_page: Option<u32>,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TagCountDto {
    pub tag: String,
    pub count: usize,
}

fn list_index_tags_work(source_path: String) -> Result<Vec<TagCountDto>, String> {
    let paths = project_paths_for_source(Path::new(&source_path))
        .map_err(|e: twinpics_core::CoreError| e.to_string())?;
    if !paths.tags_db_path.is_file() {
        return Ok(vec![]);
    }
    let rows = list_tag_counts(&paths.tags_db_path).map_err(|e: twinpics_core::CoreError| e.to_string())?;
    Ok(rows
        .into_iter()
        .map(|(tag, count)| TagCountDto { tag, count })
        .collect())
}

#[tauri::command]
pub async fn list_index_tags(source_path: String) -> Result<Vec<TagCountDto>, String> {
    tokio::task::spawn_blocking(move || list_index_tags_work(source_path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn list_indices() -> Result<Vec<IndexSummary>, String> {
    let items = list_projects().map_err(|e: twinpics_core::CoreError| e.to_string())?;
    let mut out = Vec::new();
    for (paths, cfg) in items {
        let m = Manifest::load_or_empty(&paths.manifest_path)
            .map_err(|e: twinpics_core::CoreError| e.to_string())?;
        let artefacts: Vec<String> = project_artefact_paths(&paths, false)
            .into_iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect();
        out.push(IndexSummary {
            source_path: paths.source_path.to_string_lossy().to_string(),
            file_count: m.entries.len(),
            created_at: cfg.created_at,
            project_path: paths.project_dir.to_string_lossy().to_string(),
            artefacts,
            scan_duration_ms: 0,
            process_duration_ms: 0,
            finalize_duration_ms: 0,
            index_duration_ms: 0,
        });
    }
    Ok(out)
}

fn add_index_work(
    app: tauri::AppHandle,
    folder: String,
    recursive: bool,
    backend: Arc<dyn EmbeddingBackend + Send + Sync>,
) -> Result<IndexSummary, String> {
    let source = std::path::PathBuf::from(folder);
    let source = source
        .canonicalize()
        .map_err(|e| format!("path: {e}"))?;
    let paths = project_paths_for_source(&source).map_err(|e: twinpics_core::CoreError| e.to_string())?;
    let app_for_cb = app.clone();
    let cb: ProgressCallback = Arc::new(move |p: IndexProgress| {
        if let Some(dto) = index_progress_to_event(&p) {
            let _ = app_for_cb.emit("twinpics://index-progress", &dto);
        }
    });
    let outcome = index_folder(
        &source,
        backend,
        &paths,
        IndexOptions {
            on_progress: Some(cb),
            recursive,
            model: "clip-vit-base-patch32".to_string(),
            ..Default::default()
        },
    )
    .map_err(|e: twinpics_core::CoreError| e.to_string())?;
    let m = Manifest::load_or_empty(&paths.manifest_path)
        .map_err(|e: twinpics_core::CoreError| e.to_string())?;
    let cfg: ProjectConfig = serde_json::from_slice(
        &std::fs::read(&paths.config_path).map_err(|e: std::io::Error| e.to_string())?,
    )
    .map_err(|e: serde_json::Error| e.to_string())?;
    let artefacts: Vec<String> = outcome
        .artefacts
        .iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect();
    Ok(IndexSummary {
        source_path: paths.source_path.to_string_lossy().to_string(),
        file_count: m.entries.len(),
        created_at: cfg.created_at,
        project_path: paths.project_dir.to_string_lossy().to_string(),
        artefacts,
        scan_duration_ms: outcome.scan_ms,
        process_duration_ms: outcome.process_ms,
        finalize_duration_ms: outcome.finalize_ms,
        index_duration_ms: outcome.total_ms,
    })
}

#[tauri::command]
pub async fn add_index(
    app: tauri::AppHandle,
    state: tauri::State<'_, ClipState>,
    folder: String,
    recursive: bool,
) -> Result<IndexSummary, String> {
    let backend = state.backend()?;
    tokio::task::spawn_blocking(move || add_index_work(app, folder, recursive, backend))
        .await
        .map_err(|e| e.to_string())?
}

fn search_by_image_work(
    source_path: String,
    image_path: String,
    min_score: f32,
    top_k: usize,
    backend: Arc<dyn EmbeddingBackend + Send + Sync>,
) -> Result<Vec<SearchHitDto>, String> {
    let paths = project_paths_for_source(Path::new(&source_path))
        .map_err(|e: twinpics_core::CoreError| e.to_string())?;
    let hits = search_project_image(
        &paths,
        backend,
        Path::new(&image_path),
        SearchParams {
            min_score,
            output_max: top_k,
        },
    )
    .map_err(|e: twinpics_core::CoreError| e.to_string())?;
    Ok(hits
        .into_iter()
        .map(|h| SearchHitDto {
            rank: h.rank,
            score: h.score,
            path: h.path.to_string_lossy().to_string(),
            pdf_page: h.pdf_page,
        })
        .collect())
}

#[tauri::command]
pub async fn search_by_image(
    state: tauri::State<'_, ClipState>,
    source_path: String,
    image_path: String,
    min_score: f32,
    top_k: usize,
) -> Result<Vec<SearchHitDto>, String> {
    let backend = state.backend()?;
    tokio::task::spawn_blocking(move || {
        search_by_image_work(source_path, image_path, min_score, top_k, backend)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn search_by_text_work(
    source_path: String,
    tags: Vec<String>,
    min_score: f32,
    top_k: usize,
    backend: Arc<dyn EmbeddingBackend + Send + Sync>,
) -> Result<Vec<SearchHitDto>, String> {
    let paths = project_paths_for_source(Path::new(&source_path))
        .map_err(|e: twinpics_core::CoreError| e.to_string())?;
    let hits = search_project_text(
        &paths,
        backend,
        &tags,
        SearchParams {
            min_score,
            output_max: top_k,
        },
    )
    .map_err(|e: twinpics_core::CoreError| e.to_string())?;
    Ok(hits
        .into_iter()
        .map(|h| SearchHitDto {
            rank: h.rank,
            score: h.score,
            path: h.path.to_string_lossy().to_string(),
            pdf_page: h.pdf_page,
        })
        .collect())
}

#[tauri::command]
pub async fn search_by_text(
    state: tauri::State<'_, ClipState>,
    source_path: String,
    tags: Vec<String>,
    min_score: f32,
    top_k: usize,
) -> Result<Vec<SearchHitDto>, String> {
    let backend = state.backend()?;
    tokio::task::spawn_blocking(move || {
        search_by_text_work(source_path, tags, min_score, top_k, backend)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn remove_index(source_path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        twinpics_core::clean_project(std::path::Path::new(&source_path))
            .map_err(|e: twinpics_core::CoreError| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn remove_all_indices() -> Result<(), String> {
    tokio::task::spawn_blocking(|| {
        twinpics_core::clean_all_projects()
            .map_err(|e: twinpics_core::CoreError| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Writes pasted/dropped image data (base64) to a unique temp file; returns absolute path.
#[tauri::command]
pub fn write_temp_image_b64(b64: String) -> Result<String, String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(b64.trim())
        .map_err(|e| e.to_string())?;
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    let path = std::env::temp_dir().join(format!("twinpics_query_{nanos}.img"));
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    path.to_str()
        .ok_or_else(|| "temp path: invalid UTF-8".to_string())
        .map(String::from)
}
