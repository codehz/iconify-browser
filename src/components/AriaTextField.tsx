import type { Ref } from "react";
import { Button as AriaButton, Input, SearchField } from "react-aria-components";
import "./AriaTextField.css";

interface AriaTextFieldProps {
  ariaLabel: string;
  classNamePrefix: string;
  inputRef?: Ref<HTMLInputElement>;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}

export function AriaTextField({
  ariaLabel,
  classNamePrefix,
  inputRef,
  onChange,
  placeholder,
  value,
}: AriaTextFieldProps) {
  return (
    <SearchField
      aria-label={ariaLabel}
      className={`${classNamePrefix}-field aria-search-field`}
      onChange={onChange}
      value={value}
    >
      <Input
        className={`${classNamePrefix}-input aria-search-input`}
        placeholder={placeholder}
        ref={inputRef}
      />
      {value ? (
        <AriaButton className={`${classNamePrefix}-clear-button aria-search-clear-button`}>
          <svg aria-hidden="true" viewBox="0 0 16 16">
            <path
              d="M4 4L12 12M12 4L4 12"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.5"
            />
          </svg>
        </AriaButton>
      ) : null}
    </SearchField>
  );
}
