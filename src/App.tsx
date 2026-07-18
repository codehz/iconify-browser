import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IconifyJSON } from "@iconify/types";
import { Button as AriaButton } from "react-aria-components";
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

const DETAIL_PANEL_ANIMATION_DURATION_MS = 220;

type DetailPanelPhase = "closed" | "opening" | "open" | "closing";

interface DetailPanelRenderState {
  selection: IconSelection;
  collection: IconifyJSON | null;
  collectionError: string | null;
  collectionLoading: boolean;
}

function App() {
  const [activeMainView, setActiveMainView] = useState<MainView>("browse");
  const [selectedPrefix, setSelectedPrefix] = useState<string | null>(null);
  const [browseSearchQuery, setBrowseSearchQuery] = useState("");
  const [browseSelectedSuffix, setBrowseSelectedSuffix] = useState<string | null>(null);
  const [browseSelectedCategory, setBrowseSelectedCategory] = useState("");
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [detailSelection, setDetailSelection] = useState<IconSelection | null>(null);
  const [renderedDetailPanel, setRenderedDetailPanel] = useState<DetailPanelRenderState | null>(
    null,
  );
  const [detailPanelPhase, setDetailPanelPhase] = useState<DetailPanelPhase>("closed");
  const detailPanelTimerRef = useRef<number | null>(null);
  const hadActiveDetailPanelRef = useRef(false);
  const { collections, loading: collectionsLoading } = useCollections();
  const {
    favorites: favoritePrefixes,
    favoriteSet,
    toggleFavorite: toggleFavoriteCollection,
  } = useFavoriteCollections();
  const {
    data: collectionData,
    dataPrefix: collectionDataPrefix,
    loading: collectionLoading,
    error: collectionError,
    isRefreshing: collectionRefreshing,
  } = useCollection(selectedPrefix);

  const selectedCollectionInfo = useMemo(
    () => collections.find((collection) => collection.prefix === selectedPrefix) ?? null,
    [collections, selectedPrefix],
  );
  const displayedCollectionInfo = useMemo(() => {
    if (!collectionDataPrefix) {
      return selectedCollectionInfo;
    }

    return (
      collections.find((collection) => collection.prefix === collectionDataPrefix) ??
      selectedCollectionInfo
    );
  }, [collectionDataPrefix, collections, selectedCollectionInfo]);
  const isBrowseCollectionReady =
    Boolean(collectionData && collectionDataPrefix && displayedCollectionInfo) &&
    (collectionDataPrefix === selectedPrefix || collectionRefreshing);
  const browseSelection = detailSelection?.kind === "browse" ? detailSelection : null;
  const globalSelection = detailSelection?.kind === "global-search" ? detailSelection : null;
  const isGlobalSearch = activeMainView === "global-search";
  const activeDetailPanel = useMemo<DetailPanelRenderState | null>(() => {
    if (!detailSelection) {
      return null;
    }

    const isActiveBrowseSelection =
      detailSelection.kind === "browse" &&
      detailSelection.prefix === selectedPrefix &&
      collectionDataPrefix === selectedPrefix &&
      activeMainView === "browse";

    return {
      selection: detailSelection,
      collection: isActiveBrowseSelection ? collectionData : null,
      collectionError: isActiveBrowseSelection ? collectionError : null,
      collectionLoading: isActiveBrowseSelection ? collectionLoading : false,
    };
  }, [
    activeMainView,
    collectionData,
    collectionDataPrefix,
    collectionError,
    collectionLoading,
    detailSelection,
    selectedPrefix,
  ]);
  const visibleDetailPanel = activeDetailPanel ?? renderedDetailPanel;
  const hasActiveDetailPanel = activeDetailPanel !== null;
  const isBrowseDetailSelected = browseSelection?.prefix === selectedPrefix;
  const isBrowseDetailScrollReady = !isBrowseDetailSelected || detailPanelPhase === "open";
  const isDetailPanelOpening = hasActiveDetailPanel && detailPanelPhase !== "open";
  const isDetailPanelClosing = !hasActiveDetailPanel && detailPanelPhase === "closing";

  const clearDetailPanelTimer = useCallback(() => {
    if (detailPanelTimerRef.current !== null) {
      window.clearTimeout(detailPanelTimerRef.current);
      detailPanelTimerRef.current = null;
    }
  }, []);

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

  useEffect(() => {
    if (activeDetailPanel) {
      setRenderedDetailPanel(activeDetailPanel);
    }
  }, [activeDetailPanel]);

  useEffect(() => {
    const hadActiveDetailPanel = hadActiveDetailPanelRef.current;
    hadActiveDetailPanelRef.current = hasActiveDetailPanel;

    if (hasActiveDetailPanel) {
      if (!hadActiveDetailPanel || detailPanelPhase === "closing" || renderedDetailPanel === null) {
        clearDetailPanelTimer();
        setDetailPanelPhase("opening");
        detailPanelTimerRef.current = window.setTimeout(() => {
          setDetailPanelPhase("open");
          detailPanelTimerRef.current = null;
        }, DETAIL_PANEL_ANIMATION_DURATION_MS);
      }
      return;
    }

    if (!renderedDetailPanel) {
      clearDetailPanelTimer();
      if (detailPanelPhase !== "closed") {
        setDetailPanelPhase("closed");
      }
      return;
    }

    if (hadActiveDetailPanel || detailPanelPhase === "opening" || detailPanelPhase === "open") {
      clearDetailPanelTimer();
      setDetailPanelPhase("closing");
      detailPanelTimerRef.current = window.setTimeout(() => {
        setRenderedDetailPanel(null);
        setDetailPanelPhase("closed");
        detailPanelTimerRef.current = null;
      }, DETAIL_PANEL_ANIMATION_DURATION_MS);
    }
  }, [clearDetailPanelTimer, detailPanelPhase, hasActiveDetailPanel, renderedDetailPanel]);

  useEffect(() => clearDetailPanelTimer, [clearDetailPanelTimer]);

  return (
    <div className={`app ${isGlobalSearch ? "global-search-mode" : ""}`}>
      <AriaButton
        className="view-toggle"
        onPress={() => handleSwitchView(isGlobalSearch ? "browse" : "global-search")}
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
      </AriaButton>
      {!isGlobalSearch && (
        <Sidebar
          collections={collections}
          selectedPrefix={selectedPrefix}
          onSelectCollection={handleSelectCollection}
          loading={collectionsLoading}
          favoriteSet={favoriteSet}
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
          ) : collectionError && !isBrowseCollectionReady ? (
            <div className="welcome error">{collectionError}</div>
          ) : isBrowseCollectionReady &&
            collectionData &&
            collectionDataPrefix &&
            displayedCollectionInfo ? (
            <div className="browse-main">
              <IconGrid
                collection={collectionData}
                collectionName={displayedCollectionInfo.name}
                collectionPrefix={collectionDataPrefix}
                onSearchQueryChange={setBrowseSearchQuery}
                onSelectIcon={handleSelectBrowseIcon}
                onSelectedCategoryChange={setBrowseSelectedCategory}
                onSelectedSuffixChange={setBrowseSelectedSuffix}
                searchQuery={browseSearchQuery}
                selectedCategory={browseSelectedCategory}
                isDetailSelectionScrollReady={
                  isBrowseDetailScrollReady && collectionDataPrefix === selectedPrefix
                }
                selectedIcon={
                  browseSelection?.prefix === selectedPrefix &&
                  collectionDataPrefix === selectedPrefix
                    ? browseSelection.name
                    : null
                }
                selectedSuffix={browseSelectedSuffix}
              />
              {collectionRefreshing ? (
                <div aria-live="polite" className="browse-loading-overlay">
                  <div className="browse-loading-card">加载图标包...</div>
                </div>
              ) : null}
            </div>
          ) : collectionLoading ? (
            <div className="welcome">加载图标包...</div>
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
      {visibleDetailPanel ? (
        <div
          className={`detail-panel-shell ${isDetailPanelOpening ? "is-opening" : ""} ${isDetailPanelClosing ? "is-closing" : ""}`}
        >
          <div
            aria-hidden="true"
            className={`detail-panel-shadow ${isDetailPanelOpening ? "is-opening" : ""} ${isDetailPanelClosing ? "is-closing" : ""}`}
          />
          <div className="detail-panel-layer">
            <DetailPanel
              collection={visibleDetailPanel.collection}
              collectionError={visibleDetailPanel.collectionError}
              collectionLoading={visibleDetailPanel.collectionLoading}
              onClose={handleCloseDetail}
              onOpenCollection={handleOpenCollectionFromDetail}
              selection={visibleDetailPanel.selection}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
