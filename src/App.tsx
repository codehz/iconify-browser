import { useCallback, useEffect, useMemo, useState } from "react";
import type { GlobalSearchSelection, IconSelection } from "./types";
import { useCollections } from "./hooks/useCollections";
import { useCollection } from "./hooks/useCollection";
import { useFavoriteCollections } from "./hooks/useFavoriteCollections";
import { Sidebar } from "./components/Sidebar";
import { IconGrid } from "./components/IconGrid";
import { DetailPanel } from "./components/DetailPanel";
import { GlobalSearchView } from "./components/GlobalSearchView";
import {
  getBrowseSelectionFromSelection,
  getDetailSelectionForView,
  toggleBrowseDetailSelection,
  toggleGlobalDetailSelection,
  type MainView,
} from "./utils/viewState";
import "./App.css";

function App() {
  const [activeMainView, setActiveMainView] = useState<MainView>("browse");
  const [selectedPrefix, setSelectedPrefix] = useState<string | null>(null);
  const [browseSearchQuery, setBrowseSearchQuery] = useState("");
  const [browseSelectedSuffix, setBrowseSelectedSuffix] = useState<string | null>(null);
  const [browseSelectedCategory, setBrowseSelectedCategory] = useState("");
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [detailSelection, setDetailSelection] = useState<IconSelection | null>(null);
  const { collections, loading: collectionsLoading } = useCollections();
  const {
    favorites: favoritePrefixes,
    toggleFavorite: toggleFavoriteCollection,
    isFavorite,
  } = useFavoriteCollections();
  const {
    data: collectionData,
    loading: collectionLoading,
    error: collectionError,
  } = useCollection(selectedPrefix);

  const selectedCollectionInfo = useMemo(
    () => collections.find((collection) => collection.prefix === selectedPrefix) ?? null,
    [collections, selectedPrefix],
  );
  const browseSelection = detailSelection?.kind === "browse" ? detailSelection : null;
  const globalSelection = detailSelection?.kind === "global-search" ? detailSelection : null;
  const isGlobalSearch = activeMainView === "global-search";

  const handleSelectCollection = useCallback((prefix: string) => {
    setSelectedPrefix(prefix);
    setBrowseSelectedSuffix(null);
    setBrowseSelectedCategory("");
    setDetailSelection((current) => (current?.kind === "browse" ? null : current));
  }, []);

  const handleSelectBrowseIcon = useCallback(
    (name: string) => {
      if (!selectedCollectionInfo) {
        return;
      }

      setDetailSelection((current) =>
        toggleBrowseDetailSelection(
          current,
          selectedCollectionInfo.prefix,
          selectedCollectionInfo.name,
          name,
        ),
      );
    },
    [selectedCollectionInfo],
  );

  const handleSelectGlobalHit = useCallback((selection: GlobalSearchSelection) => {
    setDetailSelection((current) => toggleGlobalDetailSelection(current, selection));
  }, []);

  const handleSwitchView = useCallback((nextView: MainView) => {
    setActiveMainView(nextView);
    setDetailSelection((current) => getDetailSelectionForView(current, nextView));
  }, []);

  const handleOpenCollectionFromDetail = useCallback((selection: IconSelection) => {
    setSelectedPrefix(selection.prefix);
    setBrowseSelectedSuffix(null);
    setBrowseSelectedCategory("");
    setActiveMainView("browse");
    setDetailSelection(getBrowseSelectionFromSelection(selection));
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailSelection(null);
  }, []);

  useEffect(() => {
    if (!selectedPrefix && collections.length > 0) {
      setSelectedPrefix(collections[0].prefix);
    }
  }, [collections, selectedPrefix]);

  return (
    <div className={`app ${isGlobalSearch ? "global-search-mode" : ""}`}>
      <button
        className="view-toggle"
        onClick={() => handleSwitchView(isGlobalSearch ? "browse" : "global-search")}
        type="button"
        title={isGlobalSearch ? "切换到图标包浏览" : "切换到全局搜索"}
      >
        <svg className="view-toggle-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
          {isGlobalSearch ? (
            <g>
              <rect
                x="1"
                y="1"
                width="6"
                height="6"
                rx="1"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <rect
                x="9"
                y="1"
                width="6"
                height="6"
                rx="1"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <rect
                x="1"
                y="9"
                width="6"
                height="6"
                rx="1"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <rect
                x="9"
                y="9"
                width="6"
                height="6"
                rx="1"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </g>
          ) : (
            <g>
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <line
                x1="10.5"
                y1="10.5"
                x2="14"
                y2="14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </g>
          )}
        </svg>
        <span>{isGlobalSearch ? "图标包浏览" : "全局搜索"}</span>
      </button>
      {!isGlobalSearch && (
        <Sidebar
          collections={collections}
          selectedPrefix={selectedPrefix}
          onSelectCollection={handleSelectCollection}
          loading={collectionsLoading}
          isFavorite={isFavorite}
          onToggleFavorite={toggleFavoriteCollection}
        />
      )}
      <main className="main-area">
        {!isGlobalSearch ? (
          !selectedPrefix ? (
            <div className="welcome">
              <h1>Iconify Browser</h1>
              <p>从左侧选择一个图标包开始浏览</p>
            </div>
          ) : collectionLoading ? (
            <div className="welcome">加载图标包...</div>
          ) : collectionError ? (
            <div className="welcome error">{collectionError}</div>
          ) : collectionData && selectedCollectionInfo ? (
            <IconGrid
              collection={collectionData}
              collectionName={selectedCollectionInfo.name}
              collectionPrefix={selectedPrefix}
              onSearchQueryChange={setBrowseSearchQuery}
              onSelectIcon={handleSelectBrowseIcon}
              onSelectedCategoryChange={setBrowseSelectedCategory}
              onSelectedSuffixChange={setBrowseSelectedSuffix}
              searchQuery={browseSearchQuery}
              selectedCategory={browseSelectedCategory}
              selectedIcon={
                browseSelection?.prefix === selectedPrefix ? browseSelection.name : null
              }
              selectedSuffix={browseSelectedSuffix}
            />
          ) : (
            <div className="welcome error">加载失败</div>
          )
        ) : (
          <GlobalSearchView
            collections={collections}
            onQueryChange={setGlobalSearchQuery}
            onSelectHit={handleSelectGlobalHit}
            query={globalSearchQuery}
            selectedHit={globalSelection}
            favoritePrefixes={favoritePrefixes}
          />
        )}
      </main>
      {detailSelection ? (
        <DetailPanel
          collection={
            detailSelection.kind === "browse" &&
            detailSelection.prefix === selectedPrefix &&
            activeMainView === "browse"
              ? collectionData
              : null
          }
          collectionError={
            detailSelection.kind === "browse" &&
            detailSelection.prefix === selectedPrefix &&
            activeMainView === "browse"
              ? collectionError
              : null
          }
          collectionLoading={
            detailSelection.kind === "browse" &&
            detailSelection.prefix === selectedPrefix &&
            activeMainView === "browse"
              ? collectionLoading
              : false
          }
          onClose={handleCloseDetail}
          onOpenCollection={handleOpenCollectionFromDetail}
          selection={detailSelection}
        />
      ) : null}
    </div>
  );
}

export default App;
