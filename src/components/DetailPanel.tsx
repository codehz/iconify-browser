import { createElement, useEffect, useMemo, useRef, useState } from "react";
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
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedFormatId, setSelectedFormatId] = useState("iconify");
  const copyResetTimerRef = useRef<number | null>(null);

  const iconHtml = useMemo(() => {
    if (!iconName || !collection) return null;
    return renderIconHTML(collection, iconName);
  }, [iconName, collection]);

  const nameFormats = useMemo(
    () => [
      {
        id: "iconify",
        label: "Iconify",
        value: `${collectionPrefix}:${iconName ?? ""}`,
      },
      {
        id: "name",
        label: "名称",
        value: iconName ?? "",
      },
      {
        id: "component",
        label: "组件名",
        value: toPascalCase(`${collectionPrefix}-${iconName ?? ""}`),
      },
      {
        id: "tailwind",
        label: "Tailwind",
        value: `icon-[${collectionPrefix}--${iconName ?? ""}]`,
      },
      {
        id: "unocss",
        label: "UnoCSS",
        value: `i-${collectionPrefix}:${iconName ?? ""}`,
      },
      {
        id: "import",
        label: "导入路径",
        value: `${collectionPrefix}/${iconName ?? ""}`,
      },
    ],
    [collectionPrefix, iconName],
  );

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setSelectedFormatId("iconify");
    setCopiedField(null);
  }, [collectionPrefix, iconName]);

  if (!iconName || !collection) return null;

  const iconData = collection.icons[iconName];
  const aliasData = !iconData && collection.aliases ? collection.aliases[iconName] : null;
  const width = iconData?.width ?? collection.width ?? 24;
  const height = iconData?.height ?? collection.height ?? 24;
  const selectedFormat =
    nameFormats.find((format) => format.id === selectedFormatId) ?? nameFormats[0];

  const handleCopy = (value: string, field: string) => {
    navigator.clipboard.writeText(value).then(
      () => {
        setCopiedField(field);
        if (copyResetTimerRef.current !== null) {
          window.clearTimeout(copyResetTimerRef.current);
        }
        copyResetTimerRef.current = window.setTimeout(() => {
          setCopiedField(null);
          copyResetTimerRef.current = null;
        }, 1200);
      },
      () => {
        // fallback: ignore clipboard errors
      },
    );
  };

  const handleCopySvg = () => {
    if (iconHtml) {
      handleCopy(iconHtml, "svg");
    }
  };

  return (
    <div className="detail-panel">
      <div className="detail-panel-header">
        <span className="detail-panel-title">
          {collectionPrefix}:{iconName}
        </span>
        <span className="detail-panel-breadcrumb">{collectionName}</span>
        <button className="detail-panel-close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="detail-panel-content">
        <div className="detail-preview-column">
          <div className="detail-preview">
            {iconHtml && (
              <div className="detail-preview-icon" dangerouslySetInnerHTML={{ __html: iconHtml }} />
            )}
          </div>
          <div className="detail-preview-size">
            {width} × {height}
          </div>
        </div>
        <div className="detail-info">
          <div className="detail-copy-section">
            <label className="detail-select-label" htmlFor="detail-format-select">
              名称格式
            </label>
            <select
              className="detail-format-select"
              id="detail-format-select"
              value={selectedFormat.id}
              onChange={(event) => setSelectedFormatId(event.target.value)}
            >
              <button className="detail-format-button" type="button">
                {createElement("selectedcontent")}
              </button>
              {nameFormats.map((format) => (
                <option className="detail-format-option" key={format.id} value={format.id}>
                  <span className="detail-format-option-content">
                    <span className="detail-option-label">{format.label}</span>
                    <span className="detail-option-value">{format.value}</span>
                  </span>
                </option>
              ))}
            </select>
            <div className="detail-copy-actions">
              <button
                className="detail-copy-button"
                onClick={() => handleCopy(selectedFormat.value, selectedFormat.id)}
              >
                {copiedField === selectedFormat.id ? "已复制" : "复制当前格式"}
              </button>
            </div>
          </div>
          {aliasData && (
            <div className="detail-meta">
              <div className="detail-info-row">
                <span className="detail-info-label">别名</span>
                <span className="detail-info-value">{aliasData.parent}</span>
              </div>
            </div>
          )}
        </div>
        <div className="detail-svg">
          <div className="detail-svg-header">
            <span>SVG</span>
            <button className="detail-svg-copy" onClick={handleCopySvg}>
              {copiedField === "svg" ? "已复制" : "复制"}
            </button>
          </div>
          <pre className="detail-svg-code">{iconHtml}</pre>
        </div>
      </div>
    </div>
  );
}

function toPascalCase(value: string) {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");
}
