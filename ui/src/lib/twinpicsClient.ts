import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

function uint8ToBase64(u8: Uint8Array): string {
  const CHUNK = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < u8.length; i += CHUNK) {
    const sub = u8.subarray(i, i + CHUNK);
    parts.push(
      String.fromCharCode.apply(
        null,
        sub as unknown as number[],
      ),
    );
  }
  return btoa(parts.join(""));
}

/** Stable DTOs aligned with Tauri `serde(rename_all = "camelCase")` responses. */
export type IndexSummary = {
  sourcePath: string;
  fileCount: number;
  createdAt: string;
  projectPath: string;
  /** Paths written for this index (e.g. usearch, manifest, config, tags DB). */
  artefacts: string[];
  /** 0 from list; set after a successful add_index. */
  scanDurationMs: number;
  processDurationMs: number;
  finalizeDurationMs: number;
  indexDurationMs: number;
};

/** Emitted on channel `twinpics://index-progress` while an index is building. */
export type IndexProgressEvent =
  | { kind: "scanning" }
  | { kind: "discovered"; total: number; scanMs: number }
  | {
      kind: "fileFinished";
      index: number;
      total: number;
      path: string;
      elapsedMs: number;
      avgMs: number;
      etaMs: number;
    }
  | { kind: "finishing" }
  | { kind: "done" };

export type SearchHit = {
  rank: number;
  score: number;
  path: string;
};

export type IndexTagItem = {
  tag: string;
  count: number;
};

export const DEFAULT_MIN_SCORE = 0.2;
export const DEFAULT_TOP_K = 10;

const INDEX_PROGRESS_EVENT = "twinpics://index-progress";

/** Subscribe to index progress (ETA, rolling average) during `addIndex`. Unlisten in `finally`. */
export function onIndexProgress(
  cb: (e: IndexProgressEvent) => void,
): Promise<UnlistenFn> {
  return listen<IndexProgressEvent>(INDEX_PROGRESS_EVENT, (e) => {
    cb(e.payload);
  });
}

export interface TwinpicsClient {
  listIndices(): Promise<IndexSummary[]>;
  addIndex(args: { folderPath: string; recursive: boolean }): Promise<IndexSummary>;
  searchByImage(args: {
    sourcePath: string;
    imagePath: string;
    minScore: number;
    topK: number;
  }): Promise<SearchHit[]>;
  searchByText(args: {
    sourcePath: string;
    tags: string[];
    minScore: number;
    topK: number;
  }): Promise<SearchHit[]>;
  listIndexTags(args: { sourcePath: string }): Promise<IndexTagItem[]>;
  writeTempImage(bytes: Uint8Array): Promise<string>;
}

async function writeTempImageB64(bytes: Uint8Array): Promise<string> {
  return invoke("write_temp_image_b64", { b64: uint8ToBase64(bytes) });
}

export const liveTwinpicsClient: TwinpicsClient = {
  listIndices: () => invoke("list_indices"),
  addIndex: ({ folderPath, recursive }) =>
    invoke("add_index", { folder: folderPath, recursive }),
  searchByImage: (args) =>
    invoke("search_by_image", {
      sourcePath: args.sourcePath,
      imagePath: args.imagePath,
      minScore: args.minScore,
      topK: args.topK,
    }),
  searchByText: (args) =>
    invoke("search_by_text", {
      sourcePath: args.sourcePath,
      tags: args.tags,
      minScore: args.minScore,
      topK: args.topK,
    }),
  listIndexTags: (args) =>
    invoke("list_index_tags", { sourcePath: args.sourcePath }),
  writeTempImage: (bytes) => writeTempImageB64(bytes),
};
