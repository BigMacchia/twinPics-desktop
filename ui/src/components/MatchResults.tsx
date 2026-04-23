import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchHit } from "@/lib/twinpicsClient";
import { MatchCard } from "./MatchCard";

type Props = {
  hits: SearchHit[];
  loading: boolean;
  error: string | null;
  hasSearched: boolean;
  className?: string;
};

export function MatchResults({
  hits,
  loading,
  error,
  hasSearched,
  className,
}: Props) {
  if (loading) {
    return (
      <div
        className={cn("flex min-h-[120px] items-center justify-center", className)}
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    );
  }

  if (hasSearched && hits.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No matches above the threshold.</p>
    );
  }

  if (!hasSearched) {
    return (
      <p className="text-sm text-muted-foreground">
        Run a search to see results here.
      </p>
    );
  }

  return (
    <div className={cn("min-w-0", className)}>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
        {hits.map((h) => (
          <MatchCard key={`${h.rank}-${h.path}`} hit={h} />
        ))}
      </div>
    </div>
  );
}
