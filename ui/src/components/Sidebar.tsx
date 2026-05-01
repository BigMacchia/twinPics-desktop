import { open } from "@tauri-apps/plugin-dialog";
import { Folder, ImageIcon, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import appIcon from "@/assets/icon.png";
import { useIndex } from "@/context/IndexContext";
import { liveTwinpicsClient, onIndexProgress } from "@/lib/twinpicsClient";
import { basename } from "@/lib/pathUtils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function formatEtaMs(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function Sidebar() {
  const {
    indices,
    selectedSourcePath,
    setSelectedSourcePath,
    refreshIndices,
    loadingList,
    listError,
  } = useIndex();
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removingAll, setRemovingAll] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [addProgress, setAddProgress] = useState<{
    total: number;
    done: number;
    avgMs: number;
    etaMs: number;
    lastPath: string;
    /** ms to scan tree (set after `discovered`). */
    scanMs: number;
    phase: "scanning" | "embedding" | "finishing";
  } | null>(null);
  const [lastAddInfo, setLastAddInfo] = useState<{
    artefacts: string[];
    indexDurationMs: number;
    scanDurationMs: number;
  } | null>(null);

  const active = indices.find((i) => i.sourcePath === selectedSourcePath);

  const onRemoveIndex = async (sourcePath: string) => {
    setRemoveError(null);
    setRemoving(sourcePath);
    try {
      if (sourcePath === selectedSourcePath) setSelectedSourcePath(null);
      await liveTwinpicsClient.removeIndex({ sourcePath });
      await refreshIndices();
    } catch (e) {
      setRemoveError(e instanceof Error ? e.message : String(e));
    } finally {
      setRemoving(null);
    }
  };

  const onRemoveAll = async () => {
    setRemoveError(null);
    setRemovingAll(true);
    try {
      setSelectedSourcePath(null);
      await liveTwinpicsClient.removeAllIndices();
      await refreshIndices();
    } catch (e) {
      setRemoveError(e instanceof Error ? e.message : String(e));
    } finally {
      setRemovingAll(false);
    }
  };

  const onAddIndex = async () => {
    setAddError(null);
    setLastAddInfo(null);
    const choice = await open({ directory: true, multiple: false });
    if (choice === null) {
      return;
    }
    const folder = Array.isArray(choice) ? choice[0] : choice;
    if (typeof folder !== "string" || !folder) {
      return;
    }
    setAdding(true);
    setAddProgress(null);
    const unlisten = await onIndexProgress((ev) => {
      if (ev.kind === "scanning") {
        setAddProgress({
          total: 0,
          done: 0,
          avgMs: 0,
          etaMs: 0,
          lastPath: "",
          scanMs: 0,
          phase: "scanning",
        });
        return;
      }
      if (ev.kind === "discovered") {
        setAddProgress({
          total: ev.total,
          done: 0,
          avgMs: 0,
          etaMs: 0,
          lastPath: "",
          scanMs: ev.scanMs,
          phase: "embedding",
        });
        return;
      }
      if (ev.kind === "fileFinished") {
        setAddProgress((p) => ({
          total: ev.total,
          done: ev.index + 1,
          avgMs: ev.avgMs,
          etaMs: ev.etaMs,
          lastPath: ev.path,
          scanMs: p?.scanMs ?? 0,
          phase: "embedding",
        }));
        return;
      }
      if (ev.kind === "finishing") {
        setAddProgress((p) =>
          p
            ? { ...p, phase: "finishing" as const }
            : {
                total: 0,
                done: 0,
                avgMs: 0,
                etaMs: 0,
                lastPath: "",
                scanMs: 0,
                phase: "finishing" as const,
              },
        );
      }
    });
    try {
      const summary = await liveTwinpicsClient.addIndex({
        folderPath: folder,
        recursive: true,
      });
      setLastAddInfo({
        artefacts: summary.artefacts,
        indexDurationMs: summary.indexDurationMs,
        scanDurationMs: summary.scanDurationMs,
      });
      await refreshIndices();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : String(e));
    } finally {
      void unlisten();
      setAddProgress(null);
      setAdding(false);
    }
  };

  return (
    <aside
      className={cn(
        "flex w-[260px] shrink-0 flex-col",
        "border-r border-sidebar-border/80 bg-sidebar",
        "shadow-[inset_-1px_0_0_0_hsl(var(--primary)/0.08)]",
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <img
          src={appIcon}
          alt=""
          className="h-9 w-9 shrink-0 rounded-xl object-cover shadow-md ring-1 ring-primary/20"
          width={36}
          height={36}
        />
        <div className="min-w-0">
          <h1 className="text-sm font-bold tracking-tight text-sidebar-foreground">
            TwinPics
          </h1>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/90">
            Image index v1.0
          </p>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      {listError && (
        <div className="px-3 pt-2">
          <Alert variant="destructive">
            <AlertTitle>Could not list indices</AlertTitle>
            <AlertDescription className="text-xs">{listError}</AlertDescription>
          </Alert>
        </div>
      )}

      {addError && (
        <div className="px-3 pt-2">
          <Alert variant="destructive">
            <AlertTitle>Could not add index</AlertTitle>
            <AlertDescription className="text-xs">{addError}</AlertDescription>
          </Alert>
        </div>
      )}

      {removeError && (
        <div className="px-3 pt-2">
          <Alert variant="destructive">
            <AlertTitle>Could not remove index</AlertTitle>
            <AlertDescription className="text-xs">{removeError}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80">
          Indices
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 rounded-full border-primary/35 bg-primary/5 px-2.5 text-[10px] font-semibold text-primary shadow-sm hover:bg-primary/12 hover:text-primary"
          onClick={() => void onAddIndex()}
          disabled={adding || loadingList}
        >
          {adding ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          )}
          Add index
        </Button>
      </div>
      {addProgress && addProgress.phase === "scanning" && (
        <div className="border-b border-sidebar-border/60 px-3 pb-3 text-[10px] text-muted-foreground">
          <Loader2 className="mb-1 inline h-3.5 w-3.5 animate-spin text-primary" />{" "}
          Scanning folder for images…
        </div>
      )}
      {addProgress && addProgress.total > 0 && (
        <div className="space-y-1.5 border-b border-sidebar-border/60 px-3 pb-3">
          {addProgress.scanMs > 0 ? (
            <p className="text-[10px] text-muted-foreground">
              Found {addProgress.total} in {addProgress.scanMs} ms
            </p>
          ) : null}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/80">
            <div
              className="h-full bg-primary transition-[width] duration-300"
              style={{
                width: `${Math.min(100, (addProgress.done / addProgress.total) * 100)}%`,
              }}
            />
          </div>
          <p className="text-[10px] font-medium text-muted-foreground">
            {addProgress.phase === "finishing" ? (
              <>Writing index…</>
            ) : (
              <>
                {addProgress.done} / {addProgress.total} · avg{" "}
                {addProgress.avgMs.toFixed(0)} ms · ETA{" "}
                {formatEtaMs(addProgress.etaMs)}
              </>
            )}
          </p>
          {addProgress.lastPath ? (
            <p
              className="truncate font-mono text-[9px] text-muted-foreground/90"
              title={addProgress.lastPath}
            >
              {addProgress.lastPath}
            </p>
          ) : null}
        </div>
      )}
      {addProgress && addProgress.total === 0 && addProgress.phase === "finishing" && (
        <div className="border-b border-sidebar-border/60 px-3 pb-3 text-[10px] text-muted-foreground">
          Writing index…
        </div>
      )}
      {lastAddInfo && lastAddInfo.artefacts.length > 0 && (
        <details className="group border-b border-sidebar-border/60 px-3 pb-2" open>
          <summary className="cursor-pointer list-none text-[10px] font-semibold text-primary/90 marker:content-none">
            <span className="group-open:opacity-60">Created index files</span>
          </summary>
          <p className="mb-1 text-[10px] text-muted-foreground">
            Done in {(lastAddInfo.indexDurationMs / 1000).toFixed(1)}s (scan{" "}
            {lastAddInfo.scanDurationMs} ms)
          </p>
          <ul className="mt-1.5 max-h-24 space-y-0.5 overflow-y-auto pl-0 text-[9px] font-mono text-muted-foreground">
            {lastAddInfo.artefacts.map((p) => (
              <li key={p} className="truncate" title={p}>
                {p}
              </li>
            ))}
          </ul>
        </details>
      )}
      <ScrollArea className="min-h-0 flex-1 px-2">
        <nav className="space-y-0.5 pb-2 pr-1 pt-1">
          {loadingList && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          {!loadingList &&
            indices.map((idx) => {
              const isActive = idx.sourcePath === selectedSourcePath;
              const name = basename(idx.sourcePath);
              return (
                <div key={idx.sourcePath} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedSourcePath(idx.sourcePath)}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-2 rounded-lg border-l-2 border-transparent px-2 py-2.5 text-left text-sm transition-colors",
                      isActive
                        ? "border-primary bg-sidebar-accent/80 text-sidebar-foreground shadow-sm ring-1 ring-primary/20"
                        : "text-muted-foreground hover:bg-sidebar-accent/40 hover:text-foreground",
                    )}
                  >
                    <Folder
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isActive ? "text-primary" : "text-muted-foreground/70",
                      )}
                      strokeWidth={1.5}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium" title={idx.sourcePath}>
                        {name}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground/90">
                        {idx.fileCount.toLocaleString()} items
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => void onRemoveIndex(idx.sourcePath)}
                    disabled={removing === idx.sourcePath || removingAll}
                    className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 disabled:opacity-50"
                    title="Remove index"
                  >
                    {removing === idx.sourcePath ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                    )}
                  </button>
                </div>
              );
            })}
        </nav>
      </ScrollArea>

      <div className="p-3">
        {indices.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mb-2 w-full gap-1.5 text-[10px] font-semibold text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => void onRemoveAll()}
            disabled={adding || loadingList || removingAll || removing !== null}
          >
            {removingAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            Remove all indices
          </Button>
        )}
        <Card className="border-sidebar-border/60 bg-card/30 shadow-md backdrop-blur-sm">
          <CardContent className="flex items-center gap-2 p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <ImageIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Active workspace
              </p>
              <p
                className="truncate text-xs font-semibold text-foreground"
                title={active?.sourcePath}
              >
                {active
                  ? basename(active.sourcePath)
                  : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {active
                  ? `${active.fileCount.toLocaleString()} indexed`
                  : "None"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </aside>
  );
}
