import { CentralPanel } from "@/components/CentralPanel";
import { RightPanel } from "@/components/RightPanel";
import { Sidebar } from "@/components/Sidebar";
import { IndexProvider } from "@/context/IndexContext";
import { SearchSettingsProvider } from "@/context/SearchSettingsContext";
import { TextSearchQueryProvider } from "@/context/TextSearchQueryContext";

function App() {
  return (
    <IndexProvider>
      <SearchSettingsProvider>
        <TextSearchQueryProvider>
          <div className="flex h-screen w-full overflow-hidden bg-background">
            <Sidebar />
            <CentralPanel />
            <RightPanel />
          </div>
        </TextSearchQueryProvider>
      </SearchSettingsProvider>
    </IndexProvider>
  );
}

export default App;