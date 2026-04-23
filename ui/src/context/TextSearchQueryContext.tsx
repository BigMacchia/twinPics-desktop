import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Ctx = {
  query: string;
  setQuery: (value: string) => void;
  appendTag: (tag: string) => void;
};

const TextSearchQueryContext = createContext<Ctx | null>(null);

export function TextSearchQueryProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");

  const appendTag = useCallback((tag: string) => {
    const t = tag.trim();
    if (!t) return;
    setQuery((prev) => (prev.length === 0 ? t : `${prev} ${t}`));
  }, []);

  const value = useMemo(
    () => ({
      query,
      setQuery,
      appendTag,
    }),
    [query, appendTag],
  );

  return (
    <TextSearchQueryContext.Provider value={value}>
      {children}
    </TextSearchQueryContext.Provider>
  );
}

export function useTextSearchQuery() {
  const v = useContext(TextSearchQueryContext);
  if (!v) {
    throw new Error("useTextSearchQuery must be used within TextSearchQueryProvider");
  }
  return v;
}
