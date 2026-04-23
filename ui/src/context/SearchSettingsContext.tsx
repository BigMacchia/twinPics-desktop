import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const DEFAULT_UI_TOP_K = 10;
export const DEFAULT_UI_MIN_SCORE = 0.3;
export const OVERFETCH_TOP_K = 20;
export const OVERFETCH_MIN_SCORE = 0.25;

export type SearchTab = "image" | "text";

type Ctx = {
  activeTab: SearchTab;
  setActiveTab: (tab: SearchTab) => void;
  imageTopK: number;
  setImageTopK: (value: number) => void;
  imageMinScore: number;
  setImageMinScore: (value: number) => void;
  textTopK: number;
  setTextTopK: (value: number) => void;
  textMinScore: number;
  setTextMinScore: (value: number) => void;
};

const SearchSettingsContext = createContext<Ctx | null>(null);

export function SearchSettingsProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<SearchTab>("image");
  const [imageTopK, setImageTopK] = useState(DEFAULT_UI_TOP_K);
  const [imageMinScore, setImageMinScore] = useState(DEFAULT_UI_MIN_SCORE);
  const [textTopK, setTextTopK] = useState(DEFAULT_UI_TOP_K);
  const [textMinScore, setTextMinScore] = useState(DEFAULT_UI_MIN_SCORE);

  const value = useMemo(
    () => ({
      activeTab,
      setActiveTab,
      imageTopK,
      setImageTopK,
      imageMinScore,
      setImageMinScore,
      textTopK,
      setTextTopK,
      textMinScore,
      setTextMinScore,
    }),
    [activeTab, imageTopK, imageMinScore, textTopK, textMinScore],
  );

  return (
    <SearchSettingsContext.Provider value={value}>
      {children}
    </SearchSettingsContext.Provider>
  );
}

export function useSearchSettings() {
  const value = useContext(SearchSettingsContext);
  if (!value) {
    throw new Error("useSearchSettings must be used within SearchSettingsProvider");
  }
  return value;
}
