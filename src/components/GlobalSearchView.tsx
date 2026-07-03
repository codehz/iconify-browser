import { useCallback, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { GlobalSearchHit, GlobalSearchSelection, CollectionItem } from "../types";
import { useGlobalIconSearch } from "../hooks/useGlobalIconSearch";
import { useSearchHitCollection } from "../hooks/useSearchHitCollection";
import { renderIconHTML } from "../utils/iconRenderer";
import { useElementWidth } from "../hooks/useElementWidth";
import "./GlobalSearchView.css";

const CARD_MIN_WIDTH = 180;
const GRID_GAP = 12;
const ROW_HEIGHT = 84; // card min-height 78 + gap 6

interface GlobalSearchViewProps {
  collections: CollectionItem[];
  query: string;
  selectedHit: GlobalSearchSelection | null;
  onQueryChange: (query: string) => void;
  onSelectHit: (selection: GlobalSearchSelection) => void;
}

export function GlobalSearchView({
  collections,
  query,
  selectedHit,
  onQueryChange,
  onSelectHit,
}: GlobalSearchViewProps) {
  const [selectedPrefixes, setSelectedPrefixes] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState("");
  const filterRef = useRef<HTMLDivElement>(null);

  const { hits: allHits, loading, error, isDebouncing } = useGlobalIconSearch(query);
  const collectionsByPrefix = useMemo(
    () => new Map(collections.map((collection) => [collection.prefix, collection])),
    [collections],
  );
  const trimmedQuery = query.trim();
  const gridRef = useRef<HTMLDivElement>(null);
  const gridWidth = useElementWidth(gridRef.current);

  const hits = useMemo(() => {
    if (selectedPrefixes.size === 0) return allHits;
    return allHits.filter((hit) => selectedPrefixes.has(hit.prefix));
  }, [allHits, selectedPrefixes]);

  const columns = useMemo(() => {
    if (gridWidth <= 0) return 4;
    return Math.max(1, Math.floor((gridWidth + GRID_GAP) / (CARD_MIN_WIDTH + GRID_GAP)));
  }, [gridWidth]);

  const rows = useMemo(() => {
    const result: GlobalSearchHit[][] = [];
    for (let i = 0; i < hits.length; i += columns) {
      result.push(hits.slice(i, i + columns));
    }
    return result;
  }, [hits, columns]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => gridRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  const statusText = useMemo(() => {
    if (loading) return "搜索中...";
    if (isDebouncing) return "输入中...";
    if (allHits.length === 0) return "";
    if (selectedPrefixes.size > 0) {
      return `找到 ${allHits.length} 个结果（显示 ${hits.length} 个）`;
    }
    return `找到 ${allHits.length} 个结果`;
  }, [loading, isDebouncing, allHits.length, hits.length, selectedPrefixes.size]);

  const collectionHitCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const hit of allHits) {
      counts.set(hit.prefix, (counts.get(hit.prefix) ?? 0) + 1);
    }
    return counts;
  }, [allHits]);

  const collectionPrefixesInResults = useMemo(() => {
    const set = new Set(allHits.map((h) => h.prefix));
    return set;
  }, [allHits]);

  const filteredCollections = useMemo(() => {
    let list = collections.filter((c) => collectionPrefixesInResults.has(c.prefix));
    if (filterSearch) {
      const lowered = filterSearch.toLowerCase();
      list = list.filter(
        (c) => c.name.toLowerCase().includes(lowered) || c.prefix.toLowerCase().includes(lowered),
      );
    }
    return list;
  }, [collections, filterSearch, collectionPrefixesInResults]);

  const hasFilter = selectedPrefixes.size > 0;

  const toggleCollection = useCallback((prefix: string) => {
    setSelectedPrefixes((prev) => {
      const next = new Set(prev);
      if (next.has(prefix)) {
        next.delete(prefix);
      } else {
        next.add(prefix);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedPrefixes(new Set(collectionPrefixesInResults));
  }, [collectionPrefixesInResults]);

  const clearAll = useCallback(() => {
    setSelectedPrefixes(new Set());
  }, []);

  const handleFilterToggle = useCallback(() => {
    setFilterOpen((prev) => !prev);
    setFilterSearch("");
  }, []);

  return (
    <div className="global-search-view">
      <div className="global-search-header">
        <div className="global-search-header-copy">
          <h2 className="global-search-title">全局搜索</h2>
          <p className="global-search-subtitle">跨全部图标包搜索并直接查看图标详情</p>
        </div>
        <div className="global-search-controls">
          <input
            className="global-search-input"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="在全部图标中搜索"
            type="text"
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
            <div className="global-search-filter-wrapper" ref={filterRef}>
              <button
                className={`global-search-filter-button ${hasFilter ? "has-filter" : ""}`}
                onClick={handleFilterToggle}
                type="button"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M1 2h12M3 7h8M5 12h4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                <span>{hasFilter ? `已选 ${selectedPrefixes.size} 个` : "全部图标包"}</span>
              </button>
              {filterOpen && (
                <>
                  <div className="global-search-filter-backdrop" onClick={handleFilterToggle} />
                  <div className="global-search-filter-dropdown">
                    <div className="global-search-filter-actions">
                      <button type="button" onClick={selectAll}>
                        全选
                      </button>
                      <button type="button" onClick={clearAll}>
                        清除
                      </button>
                    </div>
                    <input
                      className="global-search-filter-search"
                      type="text"
                      placeholder="搜索图标包..."
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                    />
                    <div className="global-search-filter-list">
                      {filteredCollections.map((col) => {
                        const checked = selectedPrefixes.has(col.prefix);
                        const matchCount = collectionHitCounts.get(col.prefix) ?? 0;
                        return (
                          <label
                            key={col.prefix}
                            className={`global-search-filter-item ${checked ? "checked" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCollection(col.prefix)}
                            />
                            <span className="global-search-filter-item-name">{col.name}</span>
                            <span className="global-search-filter-item-count">{matchCount}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          {hits.length === 0 && !loading ? (
            <div className="global-search-empty-state">无匹配图标</div>
          ) : (
            <div ref={gridRef} className="global-search-grid">
              <div
                className="global-search-virtual-space"
                style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const rowHits = rows[virtualRow.index];
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
                        const selection: GlobalSearchSelection = {
                          kind: "global-search",
                          prefix: hit.prefix,
                          name: hit.name,
                          collectionName: collection?.name ?? hit.prefix,
                          chunkId: hit.chunkId,
                          isAlias: hit.isAlias,
                        };

                        return (
                          <GlobalSearchCard
                            key={`${hit.prefix}:${hit.chunkId}:${hit.name}`}
                            isSelected={
                              selectedHit?.prefix === hit.prefix &&
                              selectedHit?.chunkId === hit.chunkId &&
                              selectedHit?.name === hit.name
                            }
                            selection={selection}
                            onSelect={onSelectHit}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface GlobalSearchCardProps {
  isSelected: boolean;
  selection: GlobalSearchSelection;
  onSelect: (selection: GlobalSearchSelection) => void;
}

function GlobalSearchCard({ isSelected, selection, onSelect }: GlobalSearchCardProps) {
  const { data, loading, error } = useSearchHitCollection(selection.prefix, selection.chunkId);
  const iconHtml = useMemo(() => {
    if (!data) {
      return null;
    }

    return renderIconHTML(data, selection.name);
  }, [data, selection.name]);

  return (
    <button
      className={`global-search-card ${isSelected ? "active" : ""}`}
      onClick={() => onSelect(selection)}
      type="button"
      title={`${selection.prefix}:${selection.name}`}
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
            <span className="global-search-card-collection" title={selection.collectionName}>
              {selection.collectionName}
            </span>
          </div>
          <div className="global-search-card-meta">
            <span className="global-search-card-prefix" title={selection.prefix}>
              {selection.prefix}
            </span>
            {selection.isAlias ? <span className="global-search-card-alias">Alias</span> : null}
          </div>
        </div>
      </div>
      <span className="global-search-card-name" title={selection.name}>
        {selection.name}
      </span>
    </button>
  );
}
