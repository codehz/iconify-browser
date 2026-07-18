import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import SimpleBar from "simplebar-react";
import type SimpleBarCore from "simplebar-core";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { IconifyJSON } from "@iconify/types";
import { Button as AriaButton, Tag, TagGroup, TagList } from "react-aria-components";
import { AriaTextField } from "./AriaTextField";
import { AriaSelectComponent, type AriaSelectOption } from "./AriaSelect";
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
  buildNameToCategories,
  countIconsByCategory,
  countIconsBySuffix,
  createSuffixMatcher,
  getCollectionCategoryEntries,
  getCollectionSuffixEntries,
} from "../utils/collectionPreview";
import "./IconGrid.css";
import { useRetimer } from "foxact/use-retimer";

interface IconGridProps {
  collection: IconifyJSON;
  collectionName: string;
  collectionPrefix: string;
  isDetailSelectionScrollReady: boolean;
  searchQuery: string;
  selectedSuffix: string | null;
  selectedCategory: string;
  selectedIcon: string | null;
  onSearchQueryChange: (query: string) => void;
  onSelectedSuffixChange: (suffix: string | null) => void;
  onSelectedCategoryChange: (category: string) => void;
  onSelectIcon: (name: string) => void;
}

interface CategoryOption extends AriaSelectOption<string> {
  category: string;
  count: number;
}

const ALL_CATEGORIES_ID = "__all__";
const DEFAULT_SUFFIX_TAG_ID = "__default__";

interface IconGridItemProps {
  name: string;
  html: string;
  isActive: boolean;
  onSelect: (name: string) => void;
}

const IconGridItem = memo(function IconGridItem({
  name,
  html,
  isActive,
  onSelect,
}: IconGridItemProps) {
  return (
    <AriaButton
      aria-label={name}
      className={`icon-grid-item ${isActive ? "active" : ""}`}
      onPress={() => onSelect(name)}
    >
      <div className="icon-grid-icon" dangerouslySetInnerHTML={{ __html: html }} />
      <span className="icon-grid-label">{name}</span>
    </AriaButton>
  );
});

export function IconGrid({
  collection,
  collectionName,
  collectionPrefix,
  isDetailSelectionScrollReady,
  searchQuery,
  selectedSuffix,
  selectedCategory,
  selectedIcon,
  onSearchQueryChange,
  onSelectedSuffixChange,
  onSelectedCategoryChange,
  onSelectIcon,
}: IconGridProps) {
  const [igScrollElement, setIgScrollElement] = useState<HTMLElement | null>(null);
  const [viewportElement, setViewportElement] = useState<HTMLDivElement | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const igSimpleBarRef = useCallback((instance: SimpleBarCore | null) => {
    if (instance) {
      setIgScrollElement(instance.getScrollElement() ?? null);
    }
  }, []);

  const allNames = useMemo(() => getIconNames(collection), [collection]);
  const suffixEntries = useMemo(() => getCollectionSuffixEntries(collection), [collection]);
  const categoryEntries = useMemo(() => getCollectionCategoryEntries(collection), [collection]);
  const matchSuffix = useMemo(() => createSuffixMatcher(suffixEntries), [suffixEntries]);
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
  const nameToCategories = useMemo(() => buildNameToCategories(categoryFilters), [categoryFilters]);
  const searchFilteredNames = useMemo(() => {
    if (!deferredSearchQuery) {
      return allNames;
    }

    const query = deferredSearchQuery.toLowerCase();
    return allNames.filter((name) => name.toLowerCase().includes(query));
  }, [allNames, deferredSearchQuery]);

  const suffixCounts = useMemo(
    () => countIconsBySuffix(searchFilteredNames, suffixEntries, matchSuffix),
    [matchSuffix, searchFilteredNames, suffixEntries],
  );
  const filteredNames = useMemo(() => {
    if (selectedSuffix === null) {
      return searchFilteredNames;
    }

    return searchFilteredNames.filter((name) => matchSuffix(name) === selectedSuffix);
  }, [matchSuffix, searchFilteredNames, selectedSuffix]);
  const categoryCounts = useMemo(
    () => countIconsByCategory(filteredNames, categoryFilters, nameToCategories),
    [categoryFilters, filteredNames, nameToCategories],
  );
  const categoryOptions = useMemo<CategoryOption[]>(
    () => [
      {
        id: ALL_CATEGORIES_ID,
        category: "全部类别",
        count: filteredNames.length,
        textValue: "全部类别",
      },
      ...categoryFilters.map((filter) => ({
        id: filter.category,
        category: filter.category,
        count: categoryCounts.get(filter.category) ?? 0,
        textValue: `${filter.category} ${categoryCounts.get(filter.category) ?? 0}`,
      })),
    ],
    [categoryCounts, categoryFilters, filteredNames.length],
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
  const nameIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    for (let index = 0; index < fullyFilteredNames.length; index += 1) {
      map.set(fullyFilteredNames[index], index);
    }
    return map;
  }, [fullyFilteredNames]);
  const rowCount = useMemo(
    () => getIconGridRowCount(fullyFilteredNames.length, columnCount),
    [columnCount, fullyFilteredNames.length],
  );
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => igScrollElement,
    estimateSize: () => ICON_GRID_ESTIMATED_ROW_HEIGHT,
    gap: ICON_GRID_GAP,
    overscan: 6,
    useFlushSync: false,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const retimer = useRetimer();

  // 滚动到图标所在行（处理 detail panel 遮挡问题）
  useEffect(() => {
    if (!selectedIcon || !isDetailSelectionScrollReady || fullyFilteredNames.length === 0) {
      return;
    }

    const iconIndex = nameIndexMap.get(selectedIcon);
    if (iconIndex === undefined) {
      return;
    }

    const rowIndex = Math.floor(iconIndex / columnCount);

    return retimer(
      window.setTimeout(() => {
        rowVirtualizer.scrollToIndex(rowIndex, { align: "center", behavior: "smooth" });
      }, 0),
    );
  }, [
    selectedIcon,
    isDetailSelectionScrollReady,
    nameIndexMap,
    fullyFilteredNames.length,
    columnCount,
    rowVirtualizer,
    retimer,
  ]);

  useEffect(() => {
    igScrollElement?.scrollTo({ top: 0 });
  }, [collectionPrefix, igScrollElement, deferredSearchQuery, selectedCategory, selectedSuffix]);

  return (
    <div className="icon-grid-container">
      <div className="icon-grid-header">
        <div className="icon-grid-header-info">
          <h2 className="icon-grid-title">{collectionName}</h2>
          <span className="icon-grid-subtitle">
            {collectionPrefix} · {allNames.length} 个图标
          </span>
        </div>
        <AriaTextField
          ariaLabel="在当前图标包中搜索"
          classNamePrefix="icon-grid-search"
          onChange={onSearchQueryChange}
          placeholder="在当前图标包中搜索"
          value={searchQuery}
        />
      </div>
      {supportsSuffixPreview || supportsCategoryPreview ? (
        <div className="icon-grid-filters">
          {supportsSuffixPreview ? (
            <TagGroup aria-label="图标后缀筛选">
              <TagList className="icon-grid-filter-group">
                {suffixEntries.map(([suffix, label]) => {
                  const count = suffixCounts.get(suffix) ?? 0;
                  const isActive = selectedSuffix === suffix;
                  return (
                    <Tag
                      id={suffix || DEFAULT_SUFFIX_TAG_ID}
                      key={suffix || DEFAULT_SUFFIX_TAG_ID}
                      className={`icon-grid-filter ${isActive ? "active" : ""}`}
                      isDisabled={count === 0 && !isActive}
                      onAction={() =>
                        onSelectedSuffixChange(selectedSuffix === suffix ? null : suffix)
                      }
                      textValue={label}
                    >
                      <span>{label}</span>
                      <span className="icon-grid-filter-count">{count}</span>
                    </Tag>
                  );
                })}
              </TagList>
            </TagGroup>
          ) : null}
          {supportsCategoryPreview ? (
            <label className="icon-grid-category-filter">
              <span className="icon-grid-category-label">类别</span>
              <AriaSelectComponent<string, CategoryOption>
                ariaLabel="类别"
                classNamePrefix="icon-grid-category"
                onSelectionChange={(value) =>
                  onSelectedCategoryChange(value === ALL_CATEGORIES_ID ? "" : value)
                }
                options={categoryOptions}
                renderOption={(option) => (
                  <span className="icon-grid-category-option-content">
                    <span className="icon-grid-category-option-label">{option.category}</span>
                    <span className="icon-grid-category-option-count">{option.count}</span>
                  </span>
                )}
                selectedKey={selectedCategory || ALL_CATEGORIES_ID}
              />
            </label>
          ) : null}
        </div>
      ) : null}
      <SimpleBar ref={igSimpleBarRef} className="icon-grid-body" autoHide={false}>
        <div className="icon-grid-content">
          {fullyFilteredNames.length === 0 ? (
            <div className="icon-grid-empty">
              {deferredSearchQuery || searchQuery ? "无匹配图标" : "暂无图标"}
            </div>
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
                            <IconGridItem
                              key={name}
                              html={html}
                              isActive={selectedIcon === name}
                              name={name}
                              onSelect={onSelectIcon}
                            />
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
      </SimpleBar>
    </div>
  );
}
