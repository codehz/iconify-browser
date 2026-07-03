import { useMemo, useState } from "react";
import type { CollectionItem } from "../types";
import "./Sidebar.css";

interface SidebarProps {
  collections: CollectionItem[];
  selectedPrefix: string | null;
  onSelectCollection: (prefix: string) => void;
  loading: boolean;
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
      <div className="sidebar-list">
        {loading ? (
          <div className="sidebar-status">加载中...</div>
        ) : filtered.length === 0 ? (
          <div className="sidebar-status">{search ? "无匹配图标包" : "暂无图标包"}</div>
        ) : search ? (
          filtered.map((col) => (
            <button
              key={col.prefix}
              className={`sidebar-item ${selectedPrefix === col.prefix ? "active" : ""}`}
              onClick={() => onSelectCollection(col.prefix)}
            >
              <span className="sidebar-item-name">{col.name}</span>
              <span className="sidebar-item-count">{col.total}</span>
            </button>
          ))
        ) : (
          grouped.map((group) => (
            <div key={group.category} className="sidebar-category">
              <div className="sidebar-category-header">{group.category}</div>
              {group.items.map((col) => (
                <button
                  key={col.prefix}
                  className={`sidebar-item ${selectedPrefix === col.prefix ? "active" : ""}`}
                  onClick={() => onSelectCollection(col.prefix)}
                >
                  <span className="sidebar-item-name">{col.name}</span>
                  <span className="sidebar-item-count">{col.total}</span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
