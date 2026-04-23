import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { ImagePlus, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useIndex } from "@/context/IndexContext";
import { liveTwinpicsClient } from "@/lib/twinpicsClient";
import {
  OVERFETCH_MIN_SCORE,
  OVERFETCH_TOP_K,
  useSearchSettings,
} from "@/context/SearchSettingsContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MatchResults } from "@/components/MatchResults";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { SearchHit } from "@/lib/twinpicsClient";

const IMAGE_EXTS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "bmp",
  "tif",
  "tiff",
  "gif",
]);

function isSupportedImagePath(p: string): boolean {
  const i = p.lastIndexOf(".");
  if (i < 0) return false;
  return IMAGE_EXTS.has(p.slice(i + 1).toLowerCase());
}

export function SearchByImageTab() {
  const { selectedSourcePath } = useIndex();
  const { imageTopK, imageMinScore } = useSearchSettings();
  const [queryPath, setQueryPath] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isDragHover, setIsDragHover] = useState(false);
  const [cache, setCache] = useState<{
    queryKey: string;
    fetchTopK: number;
    fetchMinScore: number;
    hits: SearchHit[];
  } | null>(null);

  const previewSrc = queryPath ? convertFileSrc(queryPath) : null;
  const queryKey =
    selectedSourcePath && queryPath
      ? `${selectedSourcePath}::${queryPath}`
      : null;

  const displayedHits = useMemo(() => {
    if (!cache || !queryKey || cache.queryKey !== queryKey) {
      return [];
    }
    return cache.hits
      .filter((hit) => hit.score >= imageMinScore)
      .slice(0, imageTopK);
  }, [cache, queryKey, imageMinScore, imageTopK]);

  const needsRefetch = useMemo(() => {
    if (!cache || !queryKey || cache.queryKey !== queryKey) {
      return false;
    }
    return (
      imageTopK > cache.fetchTopK || imageMinScore < cache.fetchMinScore
    );
  }, [cache, queryKey, imageMinScore, imageTopK]);

  const setQueryFromFile = useCallback(async (file: File) => {
    setFileErr(null);
    const ab = await file.arrayBuffer();
    const path = await liveTwinpicsClient.writeTempImage(new Uint8Array(ab));
    setQueryPath(path);
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items?.length) {
        return;
      }
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const f = items[i].getAsFile();
          if (f) {
            e.preventDefault();
            void setQueryFromFile(f).catch((err) =>
              setFileErr(
                err instanceof Error ? err.message : String(err),
              ),
            );
            break;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [setQueryFromFile]);

  useEffect(() => {
    let unlisten: undefined | (() => void);
    let cancelled = false;
    (async () => {
      try {
        const wv = getCurrentWebview();
        unlisten = await wv.onDragDropEvent((ev) => {
          const p = ev.payload;
          if (p.type === "enter" || p.type === "over") {
            if ("paths" in p && p.paths?.some(isSupportedImagePath)) {
              setIsDragHover(true);
            }
          } else if (p.type === "leave") {
            setIsDragHover(false);
          } else if (p.type === "drop") {
            setIsDragHover(false);
            const first = p.paths?.find(isSupportedImagePath);
            if (first) {
              setFileErr(null);
              setSearchErr(null);
              setQueryPath(first);
            } else if (p.paths?.length) {
              setFileErr(
                "Unsupported file type. Use PNG, JPG, WebP, BMP, TIFF, or GIF.",
              );
            }
          }
        });
        if (cancelled) unlisten();
      } catch {
        // ignore: native drag-drop listener unavailable
      }
    })();
    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, []);

  const onUploadClick = async () => {
    setFileErr(null);
    setSearchErr(null);
    const path = await open({
      multiple: false,
      filters: [
        {
          name: "Images",
          extensions: [
            "png",
            "jpg",
            "jpeg",
            "webp",
            "bmp",
            "tiff",
            "PNG",
            "JPG",
            "JPEG",
          ],
        },
      ],
    });
    if (path === null) {
      return;
    }
    const p = Array.isArray(path) ? path[0] : path;
    if (typeof p === "string" && p) {
      setQueryPath(p);
    }
  };

  const runSearch = useCallback(async () => {
    if (!selectedSourcePath || !queryPath || !queryKey) {
      return;
    }
    const fetchTopK = imageTopK + OVERFETCH_TOP_K;
    const fetchMinScore = Math.max(0, imageMinScore - OVERFETCH_MIN_SCORE);
    setSearchErr(null);
    setSearching(true);
    setHasSearched(true);
    try {
      const out = await liveTwinpicsClient.searchByImage({
        sourcePath: selectedSourcePath,
        imagePath: queryPath,
        minScore: fetchMinScore,
        topK: fetchTopK,
      });
      setCache({
        queryKey,
        fetchTopK,
        fetchMinScore,
        hits: out,
      });
    } catch (e) {
      setCache((current) =>
        current?.queryKey === queryKey
          ? { ...current, hits: [] }
          : current,
      );
      setSearchErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
    }
  }, [imageMinScore, imageTopK, queryKey, queryPath, selectedSourcePath]);

  if (!selectedSourcePath) {
    return (
      <Alert>
        <AlertTitle>No index selected</AlertTitle>
        <AlertDescription>
          Add an index in the left panel, or select one, then run an image
          search.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      <Card
        className={
          "border-dashed border-primary/30 bg-card/50 shadow-inner transition-colors " +
          (isDragHover ? "border-primary bg-primary/5" : "")
        }
      >
        <CardContent className="flex flex-col items-center justify-center gap-4 px-8 py-8 text-center">
          <Button
            type="button"
            className="rounded-full bg-gradient-to-r from-primary to-emerald-950/90 px-8 font-semibold text-primary-foreground shadow-lg shadow-primary/20"
            onClick={() => void onUploadClick()}
            disabled={searching}
          >
            Choose file
          </Button>

          {fileErr && (
            <p className="text-sm text-destructive" role="alert">
              {fileErr}
            </p>
          )}
          {queryPath && previewSrc && (
            <div className="mb-1 max-w-full">
              <p className="mb-1 text-xs text-muted-foreground">Query image</p>
              <div className="max-h-48 overflow-hidden rounded-xl border border-border/60">
                <img
                  src={previewSrc}
                  alt=""
                  className="max-h-48 w-auto max-w-full object-contain"
                />
              </div>
            </div>
          )}

          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
            {searching ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : (
              <ImagePlus className="h-7 w-7" strokeWidth={1.5} />
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Drag image here, paste, or upload
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Supports PNG, JPG, WebP, and more. Use Ctrl+V to paste a
              screenshot.
            </p>
          </div>

          <Button
            type="button"
            variant="secondary"
            className="rounded-full"
            onClick={() => void runSearch()}
            disabled={searching || !queryPath}
          >
            {searching ? "Searching…" : "Search"}
          </Button>
        </CardContent>
      </Card>

      <div>
        <div className="mb-3 flex items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Match image
            </h2>
            <p className="text-sm text-muted-foreground">Top results</p>
          </div>
        </div>
        {needsRefetch && !searching && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Slider values exceed cached results. Re-run search to refresh?
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="rounded-full"
              onClick={() => void runSearch()}
              disabled={searching}
            >
              Re-run search
            </Button>
          </div>
        )}
        <MatchResults
          hits={displayedHits}
          loading={searching}
          error={searchErr}
          hasSearched={hasSearched}
        />
      </div>
    </div>
  );
}
