import { useState, useMemo } from "react";
import type { IconifyJSON } from "@iconify/types";
import { renderIconHTML, getIconNames } from "../utils/iconRenderer";
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

  const allNames = useMemo(() => getIconNames(collection), [collection]);

  const filteredNames = useMemo(() => {
    if (!search) return allNames;
    const q = search.toLowerCase();
    return allNames.filter((name) => name.toLowerCase().includes(q));
  }, [allNames, search]);

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
      <div className="icon-grid-body">
        {filteredNames.length === 0 ? (
          <div className="icon-grid-empty">{search ? "无匹配图标" : "暂无图标"}</div>
        ) : (
          <div className="icon-grid">
            {filteredNames.map((name) => {
              const html = renderIconHTML(collection, name);
              if (!html) return null;
              return (
                <button
                  key={name}
                  className={`icon-grid-item ${selectedIcon === name ? "active" : ""}`}
                  onClick={() => onSelectIcon(name)}
                  title={name}
                >
                  <div className="icon-grid-icon" dangerouslySetInnerHTML={{ __html: html }} />
                  <span className="icon-grid-label">{name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
