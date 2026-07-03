import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { GlobalSearchHit, GlobalSearchSelection, CollectionItem } from "../types";
import { useGlobalIconSearch } from "../hooks/useGlobalIconSearch";
import { useSearchHitCollection } from "../hooks/useSearchHitCollection";
import { renderIconHTML } from "../utils/iconRenderer";
import { useElementWidth } from "../hooks/useElementWidth";
import "./GlobalSearchView.css";

const CARD_MIN_WIDTH = 180;
const GRID_GAP = 12;
const ROW_HEIGHT = 100; // card min-height 90 + gap 10

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
  const { hits, loading, error, isDebouncing } = useGlobalIconSearch(query);
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
    if (hits.length === 0) return "";
    return `找到 ${hits.length} 个结果`;
  }, [loading, isDebouncing, hits.length]);

  return (
    <div className="global-search-view">
      <div className="global-search-header">
        <div className="global-search-header-copy">
          <h2 className="global-search-title">全局搜索</h2>
          <p className="global-search-subtitle">跨全部图标包搜索并直接查看图标详情</p>
        </div>
        <input
          className="global-search-input"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="在全部图标中搜索"
          type="text"
          value={query}
        />
      </div>
      {!trimmedQuery ? (
        <div className="global-search-empty-state">输入图标名称，在全部图标包里查找结果。</div>
      ) : error ? (
        <div className="global-search-status global-search-status-error">{error}</div>
      ) : (
        <>
          <div className="global-search-status">{statusText}</div>
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
    >
      <div className="global-search-card-preview">
        {iconHtml ? (
          <div className="global-search-card-icon" dangerouslySetInnerHTML={{ __html: iconHtml }} />
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
      <div className="global-search-card-body">
        <span className="global-search-card-name">{selection.name}</span>
        <div className="global-search-card-meta">
          <span className="global-search-card-prefix">{selection.prefix}</span>
          {selection.isAlias ? <span className="global-search-card-alias">Alias</span> : null}
        </div>
        <span className="global-search-card-collection">{selection.collectionName}</span>
      </div>
    </button>
  );
}
