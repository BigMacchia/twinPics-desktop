import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { useIndex } from "@/context/IndexContext";
import { useTextSearchQuery } from "@/context/TextSearchQueryContext";
import { useSearchSettings } from "@/context/SearchSettingsContext";
import { liveTwinpicsClient, type IndexTagItem } from "@/lib/twinpicsClient";
import { cn } from "@/lib/utils";

const TOP_K_MIN = 1;
const TOP_K_MAX = 50;
const TOP_K_STEP = 1;

const MIN_SCORE_MIN = 0;
const MIN_SCORE_MAX = 1;
const MIN_SCORE_STEP = 0.01;

export function RightPanel() {
  const { selectedSourcePath } = useIndex();
  const { query, appendTag } = useTextSearchQuery();
  const {
    activeTab,
    imageTopK,
    setImageTopK,
    imageMinScore,
    setImageMinScore,
    textTopK,
    setTextTopK,
    textMinScore,
    setTextMinScore,
    colorTopK,
    setColorTopK,
    colorMinScore,
    setColorMinScore,
  } = useSearchSettings();

  const [tags, setTags] = useState<IndexTagItem[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagsError, setTagsError] = useState<string | null>(null);

  const isImage = activeTab === "image";
  const isColor = activeTab === "color";
  const topK = isImage ? imageTopK : isColor ? colorTopK : textTopK;
  const minScore = isImage ? imageMinScore : isColor ? colorMinScore : textMinScore;
  const setTopK = isImage ? setImageTopK : isColor ? setColorTopK : setTextTopK;
  const setMinScore = isImage
    ? setImageMinScore
    : isColor
      ? setColorMinScore
      : setTextMinScore;

  useEffect(() => {
    if ((activeTab !== "text" && activeTab !== "color") || !selectedSourcePath) {
      setTags([]);
      setTagsError(null);
      setTagsLoading(false);
      return;
    }
    let cancelled = false;
    setTagsLoading(true);
    setTagsError(null);
    void liveTwinpicsClient
      .listIndexTags({ sourcePath: selectedSourcePath })
      .then((rows) => {
        if (!cancelled) {
          setTags(rows);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setTagsError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTagsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedSourcePath]);

  const filterTokens = useMemo(
    () =>
      query
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((t) => t.toLowerCase()),
    [query],
  );

  const filteredTags = useMemo(() => {
    if (filterTokens.length === 0) {
      return tags;
    }
    return tags.filter((item) => {
      const name = item.tag.toLowerCase();
      return filterTokens.every((tok) => name.includes(tok));
    });
  }, [tags, filterTokens]);

  const showTagList = activeTab === "text" && selectedSourcePath;

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-[260px] shrink-0 flex-col",
        "border-l border-sidebar-border/80 bg-sidebar",
        "shadow-[inset_1px_0_0_0_hsl(var(--primary)/0.08)]",
      )}
    >
      <div className="p-4">
        <h2 className="text-sm font-bold tracking-tight text-sidebar-foreground">
          Search options
        </h2>
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/90">
          {isImage ? "Image search" : isColor ? "Color search" : "Text search"}
        </p>
      </div>
      <Separator className="bg-sidebar-border" />

      <div className="shrink-0 space-y-3 p-3">
        <Card className="border-sidebar-border/60 bg-card/30 shadow-md backdrop-blur-sm">
          <CardContent className="space-y-6 p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-foreground">Results</p>
                <p className="text-xs font-mono text-muted-foreground">{topK}</p>
              </div>
              <Slider
                min={TOP_K_MIN}
                max={TOP_K_MAX}
                step={TOP_K_STEP}
                value={[topK]}
                onValueChange={(value) => setTopK(value[0] ?? topK)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-foreground">Min score</p>
                <p className="text-xs font-mono text-muted-foreground">
                  {minScore.toFixed(2)}
                </p>
              </div>
              <Slider
                min={MIN_SCORE_MIN}
                max={MIN_SCORE_MAX}
                step={MIN_SCORE_STEP}
                value={[minScore]}
                onValueChange={(value) => setMinScore(value[0] ?? minScore)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {showTagList && (
        <div className="flex min-h-0 flex-1 flex-col px-3 pb-3">
          <Card className="flex min-h-0 flex-1 flex-col border-sidebar-border/60 bg-card/30 shadow-md backdrop-blur-sm">
            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
              <div className="shrink-0 border-b border-sidebar-border/60 px-3 py-2">
                <p className="text-xs font-semibold text-foreground">Tags in index</p>
                {!tagsLoading && !tagsError && tags.length > 0 && (
                  <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                    {filterTokens.length > 0
                      ? `Showing ${filteredTags.length} of ${tags.length}`
                      : `${tags.length} tags`}
                  </p>
                )}
              </div>
              {tagsLoading && (
                <div className="flex min-h-[80px] items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
              {tagsError && !tagsLoading && (
                <p className="px-3 py-2 text-xs text-destructive" role="alert">
                  {tagsError}
                </p>
              )}
              {!tagsLoading && !tagsError && tags.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  No tag index for this project (index without tags or not yet
                  built).
                </p>
              )}
              {!tagsLoading &&
                !tagsError &&
                tags.length > 0 &&
                filterTokens.length > 0 &&
                filteredTags.length === 0 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    No tags match your search
                  </p>
                )}
              {!tagsLoading &&
                !tagsError &&
                tags.length > 0 &&
                filteredTags.length > 0 && (
                <ScrollArea className="min-h-0 flex-1 px-1">
                  <ul className="space-y-0.5 py-1 pr-1">
                    {filteredTags.map((item) => (
                      <li key={item.tag}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-sidebar-accent/60"
                          title={item.tag}
                          onClick={() => appendTag(item.tag)}
                        >
                          <span className="min-w-0 flex-1 truncate text-foreground">
                            {item.tag}
                          </span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {item.count}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </aside>
  );
}
