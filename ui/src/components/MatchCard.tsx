import { convertFileSrc } from "@tauri-apps/api/core";
import { useState } from "react";
import type { SearchHit } from "@/lib/twinpicsClient";
import { basename, parentFolderName } from "@/lib/pathUtils";
import { cn } from "@/lib/utils";

type Props = {
  hit: SearchHit;
};

export function MatchCard({ hit }: Props) {
  const [imgErr, setImgErr] = useState(false);
  const src = convertFileSrc(hit.path);
  const pct = hit.score * 100;
  const file = basename(hit.path);
  const tag = parentFolderName(hit.path) || "—";

  return (
    <div className="w-full min-w-0">
      <div
        className={cn(
          "relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border/60 shadow-md",
          "ring-1 ring-primary/5",
        )}
      >
        {!imgErr ? (
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
        <div className="absolute left-2 top-2 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-sm backdrop-blur-sm">
          {pct.toFixed(1)}% match
        </div>
      </div>
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
