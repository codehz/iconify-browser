import { useMemo } from "react";
import type { IconifyJSON } from "@iconify/types";
import { renderIconHTML } from "../utils/iconRenderer";
import "./DetailPanel.css";

interface DetailPanelProps {
  iconName: string | null;
  collection: IconifyJSON | null;
  collectionName: string;
  collectionPrefix: string;
  onClose: () => void;
}

export function DetailPanel({
  iconName,
  collection,
  collectionName,
  collectionPrefix,
  onClose,
}: DetailPanelProps) {
  const iconHtml = useMemo(() => {
    if (!iconName || !collection) return null;
    return renderIconHTML(collection, iconName);
  }, [iconName, collection]);

  if (!iconName || !collection) return null;

  const iconData = collection.icons[iconName];
  const aliasData = !iconData && collection.aliases ? collection.aliases[iconName] : null;
  const width = iconData?.width ?? collection.width ?? 24;
  const height = iconData?.height ?? collection.height ?? 24;

  const handleCopy = () => {
    if (iconHtml) {
      navigator.clipboard.writeText(iconHtml).catch(() => {
        // fallback: ignore clipboard errors
      });
    }
  };

  return (
    <div className="detail-panel">
      <div className="detail-panel-header">
        <span className="detail-panel-title">{iconName}</span>
        <span className="detail-panel-breadcrumb">
          {collectionName} · {collectionPrefix}
        </span>
        <button className="detail-panel-close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="detail-panel-content">
        <div className="detail-preview">
          {iconHtml && (
            <div className="detail-preview-icon" dangerouslySetInnerHTML={{ __html: iconHtml }} />
          )}
        </div>
        <div className="detail-info">
          <div className="detail-info-row">
            <span className="detail-info-label">名称</span>
            <span className="detail-info-value">{iconName}</span>
          </div>
          <div className="detail-info-row">
            <span className="detail-info-label">集合</span>
            <span className="detail-info-value">
              {collectionName} ({collectionPrefix})
            </span>
          </div>
          <div className="detail-info-row">
            <span className="detail-info-label">尺寸</span>
            <span className="detail-info-value">
              {width} × {height}
            </span>
          </div>
          {aliasData && (
            <div className="detail-info-row">
              <span className="detail-info-label">别名</span>
              <span className="detail-info-value">{aliasData.parent}</span>
            </div>
          )}
        </div>
        <div className="detail-svg">
          <div className="detail-svg-header">
            <span>SVG</span>
            <button className="detail-svg-copy" onClick={handleCopy}>
              复制
            </button>
          </div>
          <pre className="detail-svg-code">{iconHtml}</pre>
        </div>
      </div>
    </div>
  );
}
