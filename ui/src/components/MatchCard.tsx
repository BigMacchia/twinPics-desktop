import { convertFileSrc } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { Check, Copy, FileText, FolderOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SearchHit } from "@/lib/twinpicsClient";
import { basename, parentFolderName, isPdf } from "@/lib/pathUtils";
import { cn } from "@/lib/utils";

type Props = {
  hit: SearchHit;
};

type MenuPos = { x: number; y: number };

export function MatchCard({ hit }: Props) {
  const [imgErr, setImgErr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [menu, setMenu] = useState<MenuPos | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const src = convertFileSrc(hit.path);
  const pct = hit.score * 100;
  const file = basename(hit.path);
  const tag = parentFolderName(hit.path) || "—";
  const pdf = isPdf(hit.path);

  const copyPath = async () => {
    await navigator.clipboard.writeText(hit.path);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  return (
    <div className="w-full min-w-0">
      <div
        className={cn(
          "relative aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-xl border border-border/60 shadow-md",
          "ring-1 ring-primary/5",
        )}
        onClick={() => void copyPath()}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        {pdf ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-red-50 dark:bg-red-950/20">
            <FileText className="h-10 w-10 text-red-400" strokeWidth={1.5} />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-red-400">
              PDF
            </span>
          </div>
        ) : !imgErr ? (
          <img
            src={src}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-[10px] text-muted-foreground">
            Preview unavailable
          </div>
        )}

        {/* Score / copied badge — top-left */}
        <div
          className={cn(
            "absolute left-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm backdrop-blur-sm transition-colors duration-200",
            copied
              ? "bg-green-500/90 text-white"
              : "bg-primary/90 text-primary-foreground",
          )}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" strokeWidth={2.5} />
              Copied!
            </>
          ) : (
            `${pct.toFixed(1)}% match`
          )}
        </div>

        {/* Page badge — top-right, PDF results only */}
        {pdf && hit.pdfPage !== undefined && (
          <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
            p. {hit.pdfPage + 1}
          </div>
        )}
      </div>

      {/* Context menu */}
      {menu && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[160px] overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-lg"
          style={{ left: menu.x, top: menu.y }}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm text-popover-foreground hover:bg-accent"
            onClick={() => {
              void copyPath();
              setMenu(null);
            }}
          >
            <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            Copy path
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm text-popover-foreground hover:bg-accent"
            onClick={() => {
              void revealItemInDir(hit.path);
              setMenu(null);
            }}
          >
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            Open in explorer
          </button>
        </div>
      )}

      <div className="mt-2 space-y-0.5 px-0.5">
        <p
          className="truncate text-xs font-medium text-foreground"
          title={hit.path}
        >
          {file}
        </p>
        <p className="text-[9px] font-medium uppercase tracking-wide text-primary/80">
          {tag}
        </p>
      </div>
    </div>
  );
}
