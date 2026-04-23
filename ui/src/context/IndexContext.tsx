import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { liveTwinpicsClient, type IndexSummary } from "@/lib/twinpicsClient";

type Ctx = {
  indices: IndexSummary[];
  selectedSourcePath: string | null;
  setSelectedSourcePath: (p: string | null) => void;
  refreshIndices: () => Promise<void>;
  loadingList: boolean;
  listError: string | null;
};

const IndexContext = createContext<Ctx | null>(null);

export function IndexProvider({ children }: { children: React.ReactNode }) {
  const [indices, setIndices] = useState<IndexSummary[]>([]);
  const [selectedSourcePath, setSelectedSourcePath] = useState<string | null>(
    null,
  );
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const refreshIndices = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const list = await liveTwinpicsClient.listIndices();
      setIndices(list);
      setSelectedSourcePath((cur) => {
        if (list.length === 0) {
          return null;
        }
        if (cur && list.some((x) => x.sourcePath === cur)) {
          return cur;
        }
        return list[0]!.sourcePath;
      });
    } catch (e) {
      setListError(e instanceof Error ? e.message : String(e));
      setIndices([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void refreshIndices();
  }, [refreshIndices]);

  return (
    <IndexContext.Provider
      value={{
        indices,
        selectedSourcePath,
        setSelectedSourcePath,
        refreshIndices,
        loadingList,
        listError,
      }}
    >
      {children}
    </IndexContext.Provider>
  );
}

export function useIndex() {
  const v = useContext(IndexContext);
  if (!v) {
    throw new Error("useIndex must be used within IndexProvider");
  }
  return v;
}
