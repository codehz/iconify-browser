import { useState } from "react";
import type { CollectionItem } from "../types";
import "./Sidebar.css";

interface SidebarProps {
  collections: CollectionItem[];
  selectedPrefix: string | null;
  onSelectCollection: (prefix: string) => void;
  loading: boolean;
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

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">图标包</span>
        <span className="sidebar-count">{collections.length}</span>
      </div>
      <div className="sidebar-search">
        <input
          type="text"
          placeholder="搜索图标包..."
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
        ) : (
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
        )}
      </div>
    </aside>
  );
}
