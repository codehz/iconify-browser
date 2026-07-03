import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { IconifyJSON } from "@iconify/types";
import { useElementWidth } from "../hooks/useElementWidth";
import {
  getIconGridColumnCount,
  getIconGridRowCount,
  getIconGridRowItems,
  ICON_GRID_ESTIMATED_ROW_HEIGHT,
  ICON_GRID_GAP,
} from "../utils/iconGridLayout";
import { renderIconHTML, getIconNames } from "../utils/iconRenderer";
import {
  buildCategoryNameSet,
  countIconsBySuffix,
  getCollectionCategoryEntries,
  getCollectionSuffixEntries,
  getIconSuffixKey,
} from "../utils/collectionPreview";
import "./IconGrid.css";

interface IconGridProps {
  collection: IconifyJSON;
  collectionName: string;
  collectionPrefix: string;
  selectedIcon: string | null;
  onSelectIcon: (name: string) => void;
}

export function IconGrid({
  collection,
  collectionName,
  collectionPrefix,
  selectedIcon,
  onSelectIcon,
}: IconGridProps) {
  const [search, setSearch] = useState("");
  const [selectedSuffix, setSelectedSuffix] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const [viewportElement, setViewportElement] = useState<HTMLDivElement | null>(null);
  const deferredSearch = useDeferredValue(search);

  const allNames = useMemo(() => getIconNames(collection), [collection]);
  const suffixEntries = useMemo(() => getCollectionSuffixEntries(collection), [collection]);
  const categoryEntries = useMemo(() => getCollectionCategoryEntries(collection), [collection]);
  const supportsSuffixPreview = suffixEntries.length > 0;
  const supportsCategoryPreview = categoryEntries.length > 0;
  const viewportWidth = useElementWidth(viewportElement);
  const columnCount = useMemo(() => getIconGridColumnCount(viewportWidth), [viewportWidth]);
  const categoryFilters = useMemo(
    () =>
      categoryEntries.map(([category, names]) => ({
        category,
        names: buildCategoryNameSet(names, collection.aliases),
      })),
    [categoryEntries, collection.aliases],
  );

  useEffect(() => {
    setSelectedSuffix(null);
    setSelectedCategory("");
  }, [collectionPrefix]);

  const searchFilteredNames = useMemo(() => {
    if (!deferredSearch) {
      return allNames;
    }

    const query = deferredSearch.toLowerCase();
    return allNames.filter((name) => name.toLowerCase().includes(query));
  }, [allNames, deferredSearch]);

  const suffixCounts = useMemo(
    () => countIconsBySuffix(searchFilteredNames, suffixEntries),
    [searchFilteredNames, suffixEntries],
  );
  const filteredNames = useMemo(() => {
    if (selectedSuffix === null) {
      return searchFilteredNames;
    }

    return searchFilteredNames.filter(
      (name) => getIconSuffixKey(name, suffixEntries) === selectedSuffix,
    );
  }, [searchFilteredNames, selectedSuffix, suffixEntries]);
  const categoryCounts = useMemo(
    () =>
      new Map(
        categoryFilters.map((filter) => [
          filter.category,
          filteredNames.filter((name) => filter.names.has(name)).length,
        ]),
      ),
    [categoryFilters, filteredNames],
  );
  const fullyFilteredNames = useMemo(() => {
    if (!selectedCategory) {
      return filteredNames;
    }

    const categoryFilter = categoryFilters.find((filter) => filter.category === selectedCategory);
    if (!categoryFilter) {
      return filteredNames;
    }

    return filteredNames.filter((name) => categoryFilter.names.has(name));
  }, [categoryFilters, filteredNames, selectedCategory]);
  const rowCount = useMemo(
    () => getIconGridRowCount(fullyFilteredNames.length, columnCount),
    [columnCount, fullyFilteredNames.length],
  );
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollElement,
    estimateSize: () => ICON_GRID_ESTIMATED_ROW_HEIGHT,
    gap: ICON_GRID_GAP,
    overscan: 6,
    useFlushSync: false,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    scrollElement?.scrollTo({ top: 0 });
  }, [collectionPrefix, deferredSearch, scrollElement, selectedCategory, selectedSuffix]);

  return (
    <div className="icon-grid-container">
      <div className="icon-grid-header">
        <div className="icon-grid-header-info">
          <h2 className="icon-grid-title">{collectionName}</h2>
          <span className="icon-grid-subtitle">
            {collectionPrefix} · {allNames.length} 个图标
          </span>
        </div>
        <input
          type="text"
          placeholder="搜索图标..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="icon-grid-search-input"
        />
      </div>
      {supportsSuffixPreview || supportsCategoryPreview ? (
        <div className="icon-grid-filters">
          {supportsSuffixPreview ? (
            <div className="icon-grid-filter-group">
              {suffixEntries.map(([suffix, label]) => {
                const count = suffixCounts.get(suffix) ?? 0;
                const isActive = selectedSuffix === suffix;
                return (
                  <button
                    key={suffix || "default"}
                    type="button"
                    className={`icon-grid-filter ${isActive ? "active" : ""}`}
                    onClick={() =>
                      setSelectedSuffix((current) => (current === suffix ? null : suffix))
                    }
                    disabled={count === 0 && !isActive}
                  >
                    <span>{label}</span>
                    <span className="icon-grid-filter-count">{count}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
          {supportsCategoryPreview ? (
            <label className="icon-grid-category-filter">
              <span className="icon-grid-category-label">类别</span>
              <select
                className="icon-grid-category-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">全部类别</option>
                {categoryFilters.map((filter) => (
                  <option key={filter.category} value={filter.category}>
                    {filter.category} ({categoryCounts.get(filter.category) ?? 0})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
      <div className="icon-grid-body" ref={setScrollElement}>
        {fullyFilteredNames.length === 0 ? (
          <div className="icon-grid-empty">{search ? "无匹配图标" : "暂无图标"}</div>
        ) : (
          <div className="icon-grid-virtualizer" ref={setViewportElement}>
            <div
              className="icon-grid-virtualizer-inner"
              style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
            >
              {virtualRows.map((virtualRow) => {
                const rowItems = getIconGridRowItems(
                  fullyFilteredNames,
                  virtualRow.index,
                  columnCount,
                );

                return (
                  <div
                    key={virtualRow.key}
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualRow.index}
                    className="icon-grid-row"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <div
                      className="icon-grid"
                      style={{
                        gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                      }}
                    >
                      {rowItems.map((name) => {
                        const html = renderIconHTML(collection, name);
                        if (!html) {
                          return null;
                        }

                        return (
                          <button
                            key={name}
                            className={`icon-grid-item ${selectedIcon === name ? "active" : ""}`}
                            onClick={() => onSelectIcon(name)}
                            title={name}
                          >
                            <div
                              className="icon-grid-icon"
                              dangerouslySetInnerHTML={{ __html: html }}
                            />
                            <span className="icon-grid-label">{name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
