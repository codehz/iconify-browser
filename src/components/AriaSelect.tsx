import { Icon } from "@iconify/react";
import type { IconifyIcon } from "@iconify/types";
import type { ReactNode } from "react";
import {
  Button as AriaButton,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
} from "react-aria-components";
import SimpleBar from "simplebar-react";

export interface AriaSelectOption<T extends string> {
  id: T;
  textValue?: string;
}

interface AriaSelectProps<T extends string, TOption extends AriaSelectOption<T>> {
  ariaLabel: string;
  classNamePrefix: string;
  options: TOption[];
  selectedKey: T;
  onSelectionChange: (value: T) => void;
  renderOption: (option: TOption) => ReactNode;
}

const selectChevronIcon: IconifyIcon = {
  body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m6 9l6 6l6-6"/>',
  height: 24,
  width: 24,
};

export function AriaSelectComponent<T extends string, TOption extends AriaSelectOption<T>>({
  ariaLabel,
  classNamePrefix,
  options,
  selectedKey,
  onSelectionChange,
  renderOption,
}: AriaSelectProps<T, TOption>) {
  const selectedOption = options.find((option) => option.id === selectedKey) ?? options[0];

  if (!selectedOption) {
    return null;
  }

  return (
    <Select
      aria-label={ariaLabel}
      className={`${classNamePrefix}-select`}
      onSelectionChange={(key) => {
        if (typeof key === "string") {
          onSelectionChange(key as T);
        }
      }}
      selectedKey={selectedKey}
    >
      <AriaButton className={`${classNamePrefix}-button`}>
        <SelectValue className={`${classNamePrefix}-value`}>
          {() => renderOption(selectedOption)}
        </SelectValue>
        <Icon
          aria-hidden="true"
          className={`${classNamePrefix}-chevron`}
          icon={selectChevronIcon}
        />
      </AriaButton>
      <Popover className={`${classNamePrefix}-popover`} offset={4} placement="bottom start">
        <SimpleBar autoHide={false} className={`${classNamePrefix}-scroller`}>
          <ListBox className={`${classNamePrefix}-listbox`}>
            {options.map((option) => (
              <ListBoxItem
                className={`${classNamePrefix}-option`}
                id={option.id}
                key={option.id}
                textValue={option.textValue ?? option.id}
              >
                {renderOption(option)}
              </ListBoxItem>
            ))}
          </ListBox>
        </SimpleBar>
      </Popover>
    </Select>
  );
}
