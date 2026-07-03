import type { Key } from "react";
import {
  Button as AriaButton,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
} from "react-aria-components";

export type NameFormatId = "iconify" | "name" | "component" | "tailwind" | "unocss" | "import";

export interface NameFormatOption {
  id: NameFormatId;
  label: string;
  value: string;
}

interface DetailFormatSelectProps {
  options: NameFormatOption[];
  selectedKey: NameFormatId;
  selectedOption: NameFormatOption;
  onSelectionChange: (value: NameFormatId) => void;
}

export function DetailFormatSelect({
  options,
  selectedKey,
  selectedOption,
  onSelectionChange,
}: DetailFormatSelectProps) {
  return (
    <Select
      aria-label="名称格式"
      className="detail-format-select"
      onSelectionChange={(key) => {
        if (isNameFormatId(key)) {
          onSelectionChange(key);
        }
      }}
      selectedKey={selectedKey}
    >
      <AriaButton className="detail-format-button">
        <SelectValue className="detail-format-value">
          {() => <FormatOptionContent format={selectedOption} />}
        </SelectValue>
        <span aria-hidden="true" className="detail-format-chevron">
          ▾
        </span>
      </AriaButton>
      <Popover className="detail-format-popover" offset={4} placement="bottom start">
        <ListBox className="detail-format-listbox">
          {options.map((format) => (
            <ListBoxItem
              className="detail-format-option"
              id={format.id}
              key={format.id}
              textValue={`${format.label} ${format.value}`}
            >
              {({ isSelected }) => (
                <>
                  <FormatOptionContent format={format} />
                  <span aria-hidden="true" className="detail-format-option-check">
                    {isSelected ? "✓" : ""}
                  </span>
                </>
              )}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
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
