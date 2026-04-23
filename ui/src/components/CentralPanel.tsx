import { SearchByImageTab } from "@/components/tabs/SearchByImageTab";
import { SearchByTextTab } from "@/components/tabs/SearchByTextTab";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchSettings, type SearchTab } from "@/context/SearchSettingsContext";

export function CentralPanel() {
  const { activeTab, setActiveTab } = useSearchSettings();

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border/50 bg-background/50 px-8 pb-2 pt-6">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Image match
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Find similar images in your index — by reference photo or by text
          description.
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as SearchTab)}
          className="w-full"
        >
          <TabsList
            className={cn(
              "mb-6 grid h-auto w-full max-w-md grid-cols-2 gap-1 rounded-2xl bg-muted/50 p-1.5",
            )}
          >
            <TabsTrigger
              value="image"
              className={cn(
                "rounded-xl py-2.5 text-sm data-[state=active]:bg-primary/15",
                "data-[state=active]:text-primary data-[state=active]:shadow-sm",
                "data-[state=active]:ring-1 data-[state=active]:ring-primary/30",
              )}
            >
              Search by image
            </TabsTrigger>
            <TabsTrigger
              value="text"
              className={cn(
                "rounded-xl py-2.5 text-sm data-[state=active]:bg-primary/15",
                "data-[state=active]:text-primary data-[state=active]:shadow-sm",
                "data-[state=active]:ring-1 data-[state=active]:ring-primary/30",
              )}
            >
              Search by text
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="image"
            forceMount
            className="mt-0 data-[state=inactive]:hidden"
          >
            <SearchByImageTab />
          </TabsContent>
          <TabsContent
            value="text"
            forceMount
            className="mt-0 data-[state=inactive]:hidden"
          >
            <SearchByTextTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
