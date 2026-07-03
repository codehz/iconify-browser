import { createElement, useEffect, useMemo, useRef, useState } from "react";
import type { IconifyJSON } from "@iconify/types";
import { useLocalStorage } from "foxact/use-local-storage";
import type { IconSelection } from "../types";
import { useSearchHitCollection } from "../hooks/useSearchHitCollection";
import { renderIconHTML } from "../utils/iconRenderer";
import "./DetailPanel.css";

interface DetailPanelProps {
  selection: IconSelection | null;
  collection: IconifyJSON | null;
  collectionError?: string | null;
  collectionLoading?: boolean;
  onClose: () => void;
  onOpenCollection?: (selection: IconSelection) => void;
}

const DETAIL_FORMAT_STORAGE_KEY = "iconify-browser:detail-format";
const DEFAULT_FORMAT_ID = "iconify";

type NameFormatId = "iconify" | "name" | "component" | "tailwind" | "unocss" | "import";

export function DetailPanel({
  selection,
  collection,
  collectionError = null,
  collectionLoading = false,
  onClose,
  onOpenCollection,
}: DetailPanelProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedFormatId, setSelectedFormatId] = useLocalStorage<NameFormatId>(
    DETAIL_FORMAT_STORAGE_KEY,
    DEFAULT_FORMAT_ID,
  );
  const copyResetTimerRef = useRef<number | null>(null);
  const shouldLoadSearchHit = selection?.kind === "global-search" && !collection;
  const {
    data: loadedCollection,
    loading,
    error,
  } = useSearchHitCollection(
    shouldLoadSearchHit ? selection.prefix : null,
    shouldLoadSearchHit ? selection.chunkId : null,
  );
  const resolvedCollection = collection ?? loadedCollection;
  const iconName = selection?.name ?? null;
  const collectionPrefix = selection?.prefix ?? "";
  const collectionName = selection?.collectionName ?? "";

  const iconHtml = useMemo(() => {
    if (!iconName || !resolvedCollection) return null;
    return renderIconHTML(resolvedCollection, iconName);
  }, [iconName, resolvedCollection]);

  const nameFormats = useMemo(
    () =>
      [
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
      ] satisfies Array<{ id: NameFormatId; label: string; value: string }>,
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
    setCopiedField(null);
  }, [collectionPrefix, iconName]);

  useEffect(() => {
    if (!nameFormats.some((format) => format.id === selectedFormatId)) {
      setSelectedFormatId(DEFAULT_FORMAT_ID);
    }
  }, [nameFormats, selectedFormatId, setSelectedFormatId]);

  if (!selection) return null;

  const iconData = resolvedCollection?.icons[iconName ?? ""];
  const aliasData =
    !iconData && resolvedCollection?.aliases ? resolvedCollection.aliases[iconName ?? ""] : null;
  const width = iconData?.width ?? resolvedCollection?.width ?? 24;
  const height = iconData?.height ?? resolvedCollection?.height ?? 24;
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

  return (
    <div className="detail-panel">
      <div className="detail-panel-header">
        <span className="detail-panel-title">
          {collectionPrefix}:{iconName}
        </span>
        <span className="detail-panel-breadcrumb">{collectionName}</span>
        {selection.kind === "global-search" ? (
          <button
            className="detail-panel-action"
            onClick={() => onOpenCollection?.(selection)}
            type="button"
          >
            打开所在图标包
          </button>
        ) : null}
        <button className="detail-panel-close" onClick={onClose} type="button">
          ×
        </button>
      </div>
      {loading || (selection.kind === "browse" && collectionLoading) ? (
        <div className="detail-panel-state">加载图标详情...</div>
      ) : error || (selection.kind === "browse" && collectionError) ? (
        <div className="detail-panel-state detail-panel-state-error">
          {error ?? collectionError}
        </div>
      ) : !resolvedCollection || !iconHtml ? (
        <div className="detail-panel-state detail-panel-state-error">图标详情不可用</div>
      ) : (
        <DetailPanelContent
          aliasData={aliasData}
          collectionPrefix={collectionPrefix}
          copiedField={copiedField}
          height={height}
          iconHtml={iconHtml}
          nameFormats={nameFormats}
          onCopy={handleCopy}
          selectedFormat={selectedFormat}
          selectedFormatId={selectedFormatId}
          setSelectedFormatId={setSelectedFormatId}
          width={width}
        />
      )}
    </div>
  );
}

interface DetailPanelContentProps {
  aliasData: NonNullable<IconifyJSON["aliases"]>[string] | null;
  collectionPrefix: string;
  copiedField: string | null;
  height: number;
  iconHtml: string;
  nameFormats: Array<{ id: NameFormatId; label: string; value: string }>;
  onCopy: (value: string, field: string) => void;
  selectedFormat: { id: NameFormatId; label: string; value: string };
  selectedFormatId: NameFormatId;
  setSelectedFormatId: (value: NameFormatId) => void;
  width: number;
}

function DetailPanelContent({
  aliasData,
  collectionPrefix,
  copiedField,
  height,
  iconHtml,
  nameFormats,
  onCopy,
  selectedFormat,
  selectedFormatId,
  setSelectedFormatId,
  width,
}: DetailPanelContentProps) {
  return (
    <div className="detail-panel-content">
      <div className="detail-preview-column">
        <div className="detail-preview">
          <div className="detail-preview-icon" dangerouslySetInnerHTML={{ __html: iconHtml }} />
        </div>
        <div className="detail-preview-size">
          <span>W: {width}</span>
          <span>H: {height}</span>
        </div>
      </div>
      <div className="detail-info">
        <div className="detail-copy-section">
          <select
            className="detail-format-select"
            id="detail-format-select"
            value={selectedFormatId}
            onChange={(event) => {
              if (isNameFormatId(event.target.value)) {
                setSelectedFormatId(event.target.value);
              }
            }}
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
              onClick={() => onCopy(selectedFormat.value, selectedFormat.id)}
              type="button"
            >
              {copiedField === selectedFormat.id ? "已复制" : "复制当前名称"}
            </button>
          </div>
        </div>
        <div className="detail-meta">
          <div className="detail-info-row">
            <span className="detail-info-label">前缀</span>
            <span className="detail-info-value">{collectionPrefix}</span>
          </div>
          {aliasData ? (
            <div className="detail-info-row">
              <span className="detail-info-label">别名</span>
              <span className="detail-info-value">{aliasData.parent}</span>
            </div>
          ) : null}
        </div>
      </div>
      <div className="detail-svg">
        <div className="detail-svg-header">
          <span>SVG</span>
          <button className="detail-svg-copy" onClick={() => onCopy(iconHtml, "svg")} type="button">
            {copiedField === "svg" ? "已复制" : "复制"}
          </button>
        </div>
        <pre className="detail-svg-code">{iconHtml}</pre>
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

function isNameFormatId(value: string): value is NameFormatId {
  return (
    value === "iconify" ||
    value === "name" ||
    value === "component" ||
    value === "tailwind" ||
    value === "unocss" ||
    value === "import"
  );
}
