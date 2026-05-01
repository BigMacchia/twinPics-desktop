import { Loader2, Plus, Search, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useIndex } from "@/context/IndexContext";
import { liveTwinpicsClient, type SearchHit } from "@/lib/twinpicsClient";
import {
  OVERFETCH_MIN_SCORE,
  OVERFETCH_TOP_K,
  useSearchSettings,
} from "@/context/SearchSettingsContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { MatchResults } from "@/components/MatchResults";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const DEFAULT_TOLERANCE = 28;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}


export function SearchByColorTab() {
  const { selectedSourcePath } = useIndex();
  const { colorTopK, colorMinScore } = useSearchSettings();

  const [colors, setColors] = useState<string[]>(["#3b82f6"]);
  const [tolerance, setTolerance] = useState(DEFAULT_TOLERANCE);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [cache, setCache] = useState<{
    queryKey: string;
    fetchTopK: number;
    fetchMinScore: number;
    hits: SearchHit[];
  } | null>(null);

  const queryKey = useMemo(() => {
    if (!selectedSourcePath || colors.length === 0) return null;
    return `${selectedSourcePath}::${colors.join(",")}::tol${tolerance}`;
  }, [selectedSourcePath, colors, tolerance]);

  const displayedHits = useMemo(() => {
    if (!cache || !queryKey || cache.queryKey !== queryKey) return [];
    return cache.hits
      .filter((h) => h.score >= colorMinScore)
      .slice(0, colorTopK);
  }, [cache, queryKey, colorMinScore, colorTopK]);

  const needsRefetch = useMemo(() => {
    if (!cache || !queryKey || cache.queryKey !== queryKey) return false;
    return colorTopK > cache.fetchTopK || colorMinScore < cache.fetchMinScore;
  }, [cache, queryKey, colorMinScore, colorTopK]);

  const addColor = () => {
    setColors((prev) => [...prev, prev[prev.length - 1] ?? "#888888"]);
  };

  const removeColor = (i: number) => {
    setColors((prev) => prev.filter((_, j) => j !== i));
  };

  const updateColor = (i: number, hex: string) => {
    setColors((prev) => prev.map((c, j) => (j === i ? hex : c)));
  };

  const runSearch = useCallback(async () => {
    if (!selectedSourcePath || colors.length === 0 || !queryKey) return;
    const fetchTopK = colorTopK + OVERFETCH_TOP_K;
    const fetchMinScore = Math.max(0, colorMinScore - OVERFETCH_MIN_SCORE);
    setSearchErr(null);
    setSearching(true);
    setHasSearched(true);
    try {
      const out = await liveTwinpicsClient.searchByColors({
        sourcePath: selectedSourcePath,
        colors: colors.map(hexToRgb),
        tolerance,
        minScore: fetchMinScore,
        topK: fetchTopK,
      });
      setCache({ queryKey, fetchTopK, fetchMinScore, hits: out });
    } catch (e) {
      setCache((cur) =>
        cur?.queryKey === queryKey ? { ...cur, hits: [] } : cur,
      );
      setSearchErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
    }
  }, [selectedSourcePath, colors, tolerance, colorTopK, colorMinScore, queryKey]);

  if (!selectedSourcePath) {
    return (
      <Alert>
        <AlertTitle>No index selected</AlertTitle>
        <AlertDescription>
          Add an index in the left panel, then search by color palette.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="border-border/60 bg-card/50 shadow-inner">
        <CardContent className="p-4 sm:p-6">
          <div className="space-y-5">
            {/* Color swatches row */}
            <div>
              <p className="mb-2 text-xs font-semibold text-foreground">
                Query colors
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {colors.map((hex, i) => (
                  <div key={i} className="group relative">
                    <label
                      className="block h-10 w-10 cursor-pointer overflow-hidden rounded-full border-2 border-border/60 shadow-sm transition-transform hover:scale-110 hover:border-primary/60"
                      style={{ backgroundColor: hex }}
                      title={hex}
                    >
                      <input
                        type="color"
                        value={hex}
                        onChange={(e) => updateColor(i, e.target.value)}
                        className="sr-only"
                      />
                    </label>
                    {colors.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeColor(i)}
                        className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                        title="Remove"
                      >
                        <X className="h-2.5 w-2.5" strokeWidth={3} />
                      </button>
                    )}
                    <p className="mt-1 text-center font-mono text-[9px] text-muted-foreground">
                      {hex}
                    </p>
                  </div>
                ))}

                {/* Add color button */}
                <button
                  type="button"
                  onClick={addColor}
                  disabled={colors.length >= 8}
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-primary/40 text-primary/60 transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
                  title="Add color"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* Tolerance slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-foreground">
                  Color tolerance
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {tolerance}
                </p>
              </div>
              <Slider
                min={5}
                max={60}
                step={1}
                value={[tolerance]}
                onValueChange={(v) => setTolerance(v[0] ?? DEFAULT_TOLERANCE)}
              />
              <p className="text-[10px] text-muted-foreground">
                Lower = exact match · Higher = broader hue family
              </p>
            </div>

            {/* Search button */}
            <Button
              type="button"
              className="h-11 w-full gap-2 rounded-full bg-gradient-to-r from-primary to-emerald-950/90 font-semibold text-primary-foreground shadow-lg shadow-primary/20"
              onClick={() => void runSearch()}
              disabled={searching || colors.length === 0}
            >
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {searching ? "Searching…" : "Search by color"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div>
        <div className="mb-3">
          <h2 className="text-base font-semibold text-foreground">
            Match image
          </h2>
          <p className="text-sm text-muted-foreground">
            Images ranked by color palette similarity
          </p>
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

      {hasSearched && !searching && displayedHits.length === 0 && !searchErr && (
        <Alert>
          <AlertTitle>No color data in index</AlertTitle>
          <AlertDescription>
            Re-index your folder to extract dominant colors. Existing indices
            built before this feature need to be rebuilt.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
