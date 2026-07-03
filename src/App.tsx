import { useCallback, useEffect, useMemo, useState } from "react";
import type { GlobalSearchSelection, IconSelection } from "./types";
import { useCollections } from "./hooks/useCollections";
import { useCollection } from "./hooks/useCollection";
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
    <div className="app">
      <Sidebar
        collections={collections}
        selectedPrefix={selectedPrefix}
        onSelectCollection={handleSelectCollection}
        loading={collectionsLoading}
      />
      <main className="main-area">
        <div className="main-view-switcher">
          <button
            className={`main-view-button ${activeMainView === "browse" ? "active" : ""}`}
            onClick={() => handleSwitchView("browse")}
            type="button"
          >
            浏览图标包
          </button>
          <button
            className={`main-view-button ${activeMainView === "global-search" ? "active" : ""}`}
            onClick={() => handleSwitchView("global-search")}
            type="button"
          >
            全局搜索
          </button>
        </div>
        {activeMainView === "browse" ? (
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
