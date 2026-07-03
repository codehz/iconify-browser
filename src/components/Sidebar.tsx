import { useMemo, useState } from "react";
import type { CollectionItem } from "../types";
import { ScrollArea } from "./ScrollArea";
import "./Sidebar.css";

interface SidebarProps {
  collections: CollectionItem[];
  selectedPrefix: string | null;
  onSelectCollection: (prefix: string) => void;
  loading: boolean;
  isFavorite: (prefix: string) => boolean;
  onToggleFavorite: (prefix: string) => void;
}

interface CategoryGroup {
  category: string;
  items: CollectionItem[];
}

function groupByCategory(collections: CollectionItem[]): CategoryGroup[] {
  const groups = new Map<string, CollectionItem[]>();

  for (const col of collections) {
    const cat = col.category || "未分类";
    if (!groups.has(cat)) {
      groups.set(cat, []);
    }
    groups.get(cat)!.push(col);
  }

  return Array.from(groups.entries())
    .map(([category, items]) => ({ category, items }))
    .sort((a, b) => {
      if (a.category === "未分类") return 1;
      if (b.category === "未分类") return -1;
      return 0;
    });
}

export function Sidebar({
  collections,
  selectedPrefix,
  onSelectCollection,
  loading,
  isFavorite,
  onToggleFavorite,
}: SidebarProps) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? collections.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.prefix.toLowerCase().includes(search.toLowerCase()),
      )
    : collections;

  const grouped = useMemo(() => groupByCategory(filtered), [filtered]);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">图标包</span>
        <span className="sidebar-count">{collections.length}</span>
      </div>
      <div className="sidebar-search">
        <input
          type="text"
          placeholder="筛选图标包"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sidebar-search-input"
        />
      </div>
      <ScrollArea className="sidebar-list">
        {loading ? (
          <div className="sidebar-status">加载中...</div>
        ) : filtered.length === 0 ? (
          <div className="sidebar-status">{search ? "无匹配图标包" : "暂无图标包"}</div>
        ) : search ? (
          filtered.map((col) => (
            <SidebarItem
              key={col.prefix}
              collection={col}
              isActive={selectedPrefix === col.prefix}
              isFavorite={isFavorite(col.prefix)}
              onSelect={onSelectCollection}
              onToggleFavorite={onToggleFavorite}
            />
          ))
        ) : (
          grouped.map((group) => (
            <div key={group.category} className="sidebar-category">
              <div className="sidebar-category-header">{group.category}</div>
              {group.items.map((col) => (
                <SidebarItem
                  key={col.prefix}
                  collection={col}
                  isActive={selectedPrefix === col.prefix}
                  isFavorite={isFavorite(col.prefix)}
                  onSelect={onSelectCollection}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </div>
          ))
        )}
      </ScrollArea>
    </aside>
  );
}

interface SidebarItemProps {
  collection: CollectionItem;
  isActive: boolean;
  isFavorite: boolean;
  onSelect: (prefix: string) => void;
  onToggleFavorite: (prefix: string) => void;
}

function SidebarItem({
  collection,
  isActive,
  isFavorite: isFav,
  onSelect,
  onToggleFavorite,
}: SidebarItemProps) {
  return (
    <button
      className={`sidebar-item ${isActive ? "active" : ""}`}
      onClick={() => onSelect(collection.prefix)}
    >
      <button
        className={`sidebar-favorite-button ${isFav ? "favorited" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(collection.prefix);
        }}
        type="button"
        title={isFav ? "取消收藏" : "收藏"}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M6 1.5L7.47 4.54L10.5 5.03L8.25 7.21L8.82 10.5L6 8.85L3.18 10.5L3.75 7.21L1.5 5.03L4.53 4.54L6 1.5Z"
            fill={isFav ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <span className="sidebar-item-name">{collection.name}</span>
      <span className="sidebar-item-count">{collection.total}</span>
    </button>
  );
}
