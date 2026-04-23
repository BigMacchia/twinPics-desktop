import { Search, Loader2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useIndex } from "@/context/IndexContext";
import { useTextSearchQuery } from "@/context/TextSearchQueryContext";
import { liveTwinpicsClient, type SearchHit } from "@/lib/twinpicsClient";
import {
  OVERFETCH_MIN_SCORE,
  OVERFETCH_TOP_K,
  useSearchSettings,
} from "@/context/SearchSettingsContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MatchResults } from "@/components/MatchResults";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function SearchByTextTab() {
  const { selectedSourcePath } = useIndex();
  const { textTopK, textMinScore } = useSearchSettings();
  const { query, setQuery } = useTextSearchQuery();
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [lastTags, setLastTags] = useState<string[]>([]);
  const [cache, setCache] = useState<{
    queryKey: string;
    fetchTopK: number;
    fetchMinScore: number;
    hits: SearchHit[];
  } | null>(null);

  const queryKey =
    selectedSourcePath && lastTags.length > 0
      ? `${selectedSourcePath}::${lastTags.join("\u001f")}`
      : null;

  const displayedHits = useMemo(() => {
    if (!cache || !queryKey || cache.queryKey !== queryKey) {
      return [];
    }
    return cache.hits
      .filter((hit) => hit.score >= textMinScore)
      .slice(0, textTopK);
  }, [cache, queryKey, textMinScore, textTopK]);

  const needsRefetch = useMemo(() => {
    if (!cache || !queryKey || cache.queryKey !== queryKey) {
      return false;
    }
    return textTopK > cache.fetchTopK || textMinScore < cache.fetchMinScore;
  }, [cache, queryKey, textMinScore, textTopK]);

  const runSearch = useCallback(
    async (overrideTags?: string[]) => {
      if (!selectedSourcePath) {
        return;
      }
      const tags =
        overrideTags ??
        query
          .trim()
          .split(/\s+/)
          .filter(Boolean);
      if (tags.length === 0) {
        setSearchErr("Enter at least one word or phrase.");
        return;
      }
      const queryId = `${selectedSourcePath}::${tags.join("\u001f")}`;
      const fetchTopK = textTopK + OVERFETCH_TOP_K;
      const fetchMinScore = Math.max(0, textMinScore - OVERFETCH_MIN_SCORE);
      setSearchErr(null);
      setSearching(true);
      setHasSearched(true);
      setLastTags(tags);
      try {
        const out = await liveTwinpicsClient.searchByText({
          sourcePath: selectedSourcePath,
          tags,
          minScore: fetchMinScore,
          topK: fetchTopK,
        });
        setCache({
          queryKey: queryId,
          fetchTopK,
          fetchMinScore,
          hits: out,
        });
      } catch (e) {
        setCache((current) =>
          current?.queryKey === queryId
            ? { ...current, hits: [] }
            : current,
        );
        setSearchErr(e instanceof Error ? e.message : String(e));
      } finally {
        setSearching(false);
      }
    },
    [query, selectedSourcePath, textMinScore, textTopK],
  );

  if (!selectedSourcePath) {
    return (
      <Alert>
        <AlertTitle>No index selected</AlertTitle>
        <AlertDescription>
          Add an index in the left panel, or select one, then run a text
          search.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="border-border/60 bg-card/50 shadow-inner">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              className="h-11 flex-1 rounded-full border-border/80 bg-input/30"
              placeholder="Describe the image you're looking for..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void runSearch();
                }
              }}
              disabled={searching}
            />
            <Button
              type="button"
              className="h-11 shrink-0 gap-2 rounded-full bg-gradient-to-r from-primary to-emerald-950/90 font-semibold text-primary-foreground shadow-lg shadow-primary/20"
              onClick={() => void runSearch()}
              disabled={searching}
            >
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {searching ? "Searching…" : "Search"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <div className="mb-3">
          <h2 className="text-base font-semibold text-foreground">
            Match image
          </h2>
          <p className="text-sm text-muted-foreground">Top results</p>
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
              onClick={() => void runSearch(lastTags)}
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
