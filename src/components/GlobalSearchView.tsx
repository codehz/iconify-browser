import { useMemo } from "react";
import type { GlobalSearchSelection, CollectionItem } from "../types";
import { useGlobalIconSearch } from "../hooks/useGlobalIconSearch";
import { useSearchHitCollection } from "../hooks/useSearchHitCollection";
import { renderIconHTML } from "../utils/iconRenderer";
import "./GlobalSearchView.css";

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
  const { hits, loading, error } = useGlobalIconSearch(query, 100);
  const collectionsByPrefix = useMemo(
    () => new Map(collections.map((collection) => [collection.prefix, collection])),
    [collections],
  );
  const trimmedQuery = query.trim();

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
          <div className="global-search-status">
            {loading ? "搜索中..." : `找到 ${hits.length} 个结果`}
          </div>
          {hits.length === 0 && !loading ? (
            <div className="global-search-empty-state">无匹配图标</div>
          ) : (
            <div className="global-search-grid">
              {hits.map((hit) => {
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
                      selectedHit.chunkId === hit.chunkId &&
                      selectedHit.name === hit.name
                    }
                    selection={selection}
                    onSelect={onSelectHit}
                  />
                );
              })}
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
