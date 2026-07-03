import type { Key } from "react";
import { AriaSelectComponent, type AriaSelectOption } from "./AriaSelect";

export type NameFormatId = "iconify" | "name" | "component" | "tailwind" | "unocss" | "import";

export interface NameFormatOption extends AriaSelectOption<NameFormatId> {
  label: string;
  value: string;
}

interface DetailFormatSelectProps {
  options: NameFormatOption[];
  selectedKey: NameFormatId;
  onSelectionChange: (value: NameFormatId) => void;
}

export function DetailFormatSelect({
  options,
  selectedKey,
  onSelectionChange,
}: DetailFormatSelectProps) {
  return (
    <AriaSelectComponent<NameFormatId, NameFormatOption>
      ariaLabel="名称格式"
      classNamePrefix="detail-format"
      onSelectionChange={(key) => {
        if (isNameFormatId(key)) {
          onSelectionChange(key);
        }
      }}
      options={options}
      renderOption={(format) => <FormatOptionContent format={format} />}
      selectedKey={selectedKey}
    />
  );
}

function FormatOptionContent({ format }: { format: NameFormatOption }) {
  return (
    <span className="detail-format-option-content">
      <span className="detail-option-label">{format.label}</span>
      <span className="detail-option-value">{format.value}</span>
    </span>
  );
}

function isNameFormatId(value: Key | null): value is NameFormatId {
  return (
    value === "iconify" ||
    value === "name" ||
    value === "component" ||
    value === "tailwind" ||
    value === "unocss" ||
    value === "import"
  );
}
