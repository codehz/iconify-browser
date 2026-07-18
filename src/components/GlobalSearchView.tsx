import { Icon } from "@iconify/react";
import type { IconifyIcon, IconifyJSON } from "@iconify/types";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button as AriaButton,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  type Key,
} from "react-aria-components";
import SimpleBar from "simplebar-react";
import type SimpleBarCore from "simplebar-core";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { GlobalSearchSelection, CollectionItem } from "../types";
import { AriaTextField } from "./AriaTextField";
import { useGlobalIconSearch } from "../hooks/useGlobalIconSearch";
import {
  useEnsureSearchHitChunks,
  useSearchHitChunk,
  type SearchHitChunkKey,
} from "../hooks/useSearchHitChunks";
import { renderIconHTML } from "../utils/iconRenderer";
import { useElementWidth } from "../hooks/useElementWidth";
import { ScrollArea } from "./ScrollArea";
import "./GlobalSearchView.css";

const CARD_MIN_WIDTH = 180;
const GRID_GAP = 12;
const ROW_HEIGHT = 84; // card min-height 78 + gap 6

const filterIcon: IconifyIcon = {
  body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.75" d="M3 5h18M6 12h12M10 19h4"/>',
  width: 24,
  height: 24,
};

const chevronIcon: IconifyIcon = {
  body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m7 10l5 5l5-5"/>',
  width: 24,
  height: 24,
};

const clearIcon: IconifyIcon = {
  body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.75" d="m6 6l12 12M18 6L6 18"/>',
  width: 24,
  height: 24,
};

interface GlobalSearchViewProps {
  collections: CollectionItem[];
  query: string;
  selectedHit: GlobalSearchSelection | null;
  onQueryChange: (query: string) => void;
  onSelectHit: (selection: GlobalSearchSelection) => void;
  favoritePrefixes: string[];
}

export function GlobalSearchView({
  collections,
  query,
  selectedHit,
  onQueryChange,
  onSelectHit,
  favoritePrefixes,
}: GlobalSearchViewProps) {
  const [selectedPrefixes, setSelectedPrefixes] = useState<Set<string>>(() => {
    // Initialize with favorites so search is scoped to favorite collections by default
    return new Set(favoritePrefixes);
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState("");
  const filterSearchInputRef = useRef<HTMLInputElement>(null);

  const { hits, loading, error, isDebouncing } = useGlobalIconSearch(query, {
    prefixes: selectedPrefixes.size > 0 ? selectedPrefixes : undefined,
  });
  const collectionsByPrefix = useMemo(
    () => new Map(collections.map((collection) => [collection.prefix, collection])),
    [collections],
  );
  const trimmedQuery = query.trim();
  const gridRef = useRef<HTMLDivElement>(null);
  const gridWidth = useElementWidth(gridRef.current);

  const columns = useMemo(() => {
    if (gridWidth <= 0) return 4;
    return Math.max(1, Math.floor((gridWidth + GRID_GAP) / (CARD_MIN_WIDTH + GRID_GAP)));
  }, [gridWidth]);

  const rowCount = columns > 0 ? Math.ceil(hits.length / columns) : 0;

  const [gsScrollElement, setGsScrollElement] = useState<HTMLElement | null>(null);

  const gsSimpleBarRef = useCallback((instance: SimpleBarCore | null) => {
    if (instance) {
      setGsScrollElement(instance.getScrollElement() ?? null);
    }
  }, []);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => gsScrollElement,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  const rangeStart = virtualItems[0]?.index ?? 0;
  const rangeEnd = virtualItems[virtualItems.length - 1]?.index ?? -1;

  const visibleChunkKeys = useMemo(() => {
    if (rangeEnd < rangeStart || columns <= 0) {
      return [] as SearchHitChunkKey[];
    }

    const map = new Map<string, SearchHitChunkKey>();
    for (let rowIndex = rangeStart; rowIndex <= rangeEnd; rowIndex += 1) {
      const start = rowIndex * columns;
      const end = Math.min(start + columns, hits.length);
      for (let index = start; index < end; index += 1) {
        const hit = hits[index];
        const id = `${hit.prefix}:${hit.chunkId}`;
        if (!map.has(id)) {
          map.set(id, { prefix: hit.prefix, chunkId: hit.chunkId });
        }
      }
    }
    return Array.from(map.values());
  }, [columns, hits, rangeEnd, rangeStart]);

  useEnsureSearchHitChunks(visibleChunkKeys);

  const statusText = useMemo(() => {
    if (loading) return "搜索中...";
    if (isDebouncing) return "输入中...";
    if (hits.length === 0) return "";
    if (selectedPrefixes.size > 0) {
      return `找到 ${hits.length} 个结果（已筛选 ${selectedPrefixes.size} 个图标包）`;
    }
    return `找到 ${hits.length} 个结果`;
  }, [loading, isDebouncing, hits.length, selectedPrefixes.size]);

  const collectionHitCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const hit of hits) {
      counts.set(hit.prefix, (counts.get(hit.prefix) ?? 0) + 1);
    }
    return counts;
  }, [hits]);

  const filteredCollections = useMemo(() => {
    let list = collections
      .map((c, i) => ({
        ...c,
        index: i,
        matchCount: collectionHitCounts.get(c.prefix) ?? 0,
      }))
      .sort((a, b) => {
        // Collections with hits first, then zero-hit at bottom
        if (a.matchCount > 0 && b.matchCount === 0) return -1;
        if (a.matchCount === 0 && b.matchCount > 0) return 1;
        // Within same group, preserve original collection order
        return a.index - b.index;
      });
    if (filterSearch) {
      const lowered = filterSearch.toLowerCase();
      list = list.filter(
        (c) => c.name.toLowerCase().includes(lowered) || c.prefix.toLowerCase().includes(lowered),
      );
    }
    return list;
  }, [collections, filterSearch, collectionHitCounts]);

  const hasFilter = selectedPrefixes.size > 0;

  const selectedCollectionLabel = useMemo(() => {
    if (!hasFilter) {
      return "全部图标包";
    }

    if (selectedPrefixes.size === 1) {
      const [prefix] = selectedPrefixes;
      return collectionsByPrefix.get(prefix)?.name ?? prefix;
    }

    return `已筛选 ${selectedPrefixes.size} 个`;
  }, [collectionsByPrefix, hasFilter, selectedPrefixes]);

  const clearAll = useCallback(() => {
    setSelectedPrefixes(new Set());
  }, []);

  const handleFilterOpenChange = useCallback((open: boolean) => {
    setFilterOpen(open);
    if (!open) {
      setFilterSearch("");
    }
  }, []);

  const handleFilterValueChange = useCallback((keys: Key[]) => {
    setSelectedPrefixes(new Set(keys.map((key) => String(key))));
  }, []);

  useEffect(() => {
    if (!filterOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      filterSearchInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [filterOpen]);

  return (
    <div className="global-search-view">
      <div className="global-search-header">
        <div className="global-search-header-copy">
          <h2 className="global-search-title">全局搜索</h2>
          <p className="global-search-subtitle">跨全部图标包搜索并直接查看图标详情</p>
        </div>
        <div className="global-search-controls">
          <AriaTextField
            ariaLabel="在全部图标中搜索"
            classNamePrefix="global-search"
            onChange={onQueryChange}
            placeholder="在全部图标中搜索"
            value={query}
          />
        </div>
      </div>
      {!trimmedQuery ? (
        <div className="global-search-empty-state">输入图标名称，在全部图标包里查找结果。</div>
      ) : error ? (
        <div className="global-search-status global-search-status-error">{error}</div>
      ) : (
        <>
          <div className="global-search-status">
            <span>{statusText}</span>
            <div className="global-search-filter-controls">
              <Select
                aria-label="筛选图标包"
                className={`global-search-filter-select ${filterOpen ? "is-open" : ""}`}
                isOpen={filterOpen}
                onChange={handleFilterValueChange}
                onOpenChange={handleFilterOpenChange}
                selectionMode="multiple"
                value={Array.from(selectedPrefixes)}
              >
                <AriaButton
                  className={`global-search-filter-button ${hasFilter ? "has-filter" : ""}`}
                >
                  <Icon
                    aria-hidden="true"
                    className="global-search-filter-button-icon"
                    icon={filterIcon}
                  />
                  <SelectValue className="global-search-filter-button-label">
                    {selectedCollectionLabel}
                  </SelectValue>
                  <Icon
                    aria-hidden="true"
                    className="global-search-filter-button-chevron"
                    icon={chevronIcon}
                  />
                </AriaButton>
                <Popover className="global-search-filter-popover" offset={8} placement="bottom end">
                  <div className="global-search-filter-panel">
                    <AriaTextField
                      ariaLabel="搜索图标包"
                      classNamePrefix="global-search-filter-search"
                      inputRef={filterSearchInputRef}
                      onChange={setFilterSearch}
                      placeholder="搜索图标包..."
                      value={filterSearch}
                    />
                    <ScrollArea className="global-search-filter-list">
                      <ListBox
                        className="global-search-filter-listbox"
                        renderEmptyState={() => (
                          <div className="global-search-filter-empty">无匹配图标包</div>
                        )}
                      >
                        {filteredCollections.map((col) => {
                          const hasMatch = col.matchCount > 0;
                          return (
                            <ListBoxItem
                              className={`global-search-filter-item ${!hasMatch ? "no-match" : ""}`}
                              id={col.prefix}
                              key={col.prefix}
                              textValue={`${col.name} ${col.prefix}`}
                            >
                              <span className="global-search-filter-item-indicator" />
                              <span className="global-search-filter-item-copy">
                                <span className="global-search-filter-item-name">{col.name}</span>
                                <span className="global-search-filter-item-prefix">
                                  {col.prefix}
                                </span>
                              </span>
                              <span className="global-search-filter-item-count">
                                {col.matchCount}
                              </span>
                            </ListBoxItem>
                          );
                        })}
                      </ListBox>
                    </ScrollArea>
                  </div>
                </Popover>
              </Select>
              <AriaButton
                className="global-search-filter-clear-button"
                isDisabled={!hasFilter}
                onPress={clearAll}
              >
                <Icon
                  aria-hidden="true"
                  className="global-search-filter-clear-icon"
                  icon={clearIcon}
                />
                <span>清除筛选</span>
              </AriaButton>
            </div>
          </div>
          {hits.length === 0 && !loading ? (
            <div className="global-search-empty-state">无匹配图标</div>
          ) : (
            <div ref={gridRef} className="global-search-grid-outer">
              <SimpleBar ref={gsSimpleBarRef} className="global-search-grid" autoHide={false}>
                <div className="global-search-grid-content">
                  <div
                    className="global-search-virtual-space"
                    style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
                  >
                    {virtualItems.map((virtualRow) => {
                      const start = virtualRow.index * columns;
                      const end = Math.min(start + columns, hits.length);
                      const rowHits = hits.slice(start, end);
                      return (
                        <div
                          key={virtualRow.key}
                          className="global-search-row"
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                          }}
                        >
                          {rowHits.map((hit) => {
                            const collection = collectionsByPrefix.get(hit.prefix);

                            return (
                              <GlobalSearchCard
                                key={`${hit.prefix}:${hit.chunkId}:${hit.name}`}
                                chunkId={hit.chunkId}
                                collectionName={collection?.name ?? hit.prefix}
                                isAlias={hit.isAlias}
                                isSelected={
                                  selectedHit?.prefix === hit.prefix &&
                                  selectedHit?.chunkId === hit.chunkId &&
                                  selectedHit?.name === hit.name
                                }
                                name={hit.name}
                                prefix={hit.prefix}
                                onSelect={onSelectHit}
                              />
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </SimpleBar>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface GlobalSearchCardProps {
  prefix: string;
  name: string;
  chunkId: number;
  isAlias: boolean;
  collectionName: string;
  isSelected: boolean;
  onSelect: (selection: GlobalSearchSelection) => void;
}

const GlobalSearchCard = memo(function GlobalSearchCard({
  prefix,
  name,
  chunkId,
  isAlias,
  collectionName,
  isSelected,
  onSelect,
}: GlobalSearchCardProps) {
  const chunkState = useSearchHitChunk(prefix, chunkId);
  const data: IconifyJSON | null = chunkState.data;
  const loading = chunkState.loading || (!chunkState.data && !chunkState.error);
  const error = chunkState.error;
  const iconHtml = useMemo(() => {
    if (!data) {
      return null;
    }

    return renderIconHTML(data, name);
  }, [data, name]);

  const handlePress = useCallback(() => {
    onSelect({
      kind: "global-search",
      prefix,
      name,
      collectionName,
      chunkId,
      isAlias,
    });
  }, [chunkId, collectionName, isAlias, name, onSelect, prefix]);

  return (
    <AriaButton
      aria-label={`${prefix}:${name}`}
      className={`global-search-card ${isSelected ? "active" : ""}`}
      onPress={handlePress}
    >
      <div className="global-search-card-top">
        <div className="global-search-card-preview">
          {iconHtml ? (
            <div
              className="global-search-card-icon"
              dangerouslySetInnerHTML={{ __html: iconHtml }}
            />
          ) : (
            <div
              className={`global-search-card-placeholder ${loading ? "loading" : ""} ${
                error ? "error" : ""
              }`}
            >
              {error ? "!" : ""}
            </div>
          )}
        </div>
        <div className="global-search-card-info">
          <div className="global-search-card-source">
            <span className="global-search-card-collection" title={collectionName}>
              {collectionName}
            </span>
          </div>
          <div className="global-search-card-meta">
            <span className="global-search-card-prefix" title={prefix}>
              {prefix}
            </span>
            {isAlias ? <span className="global-search-card-alias">Alias</span> : null}
          </div>
        </div>
      </div>
      <span className="global-search-card-name" title={name}>
        {name}
      </span>
    </AriaButton>
  );
});
