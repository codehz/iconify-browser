import type { Ref } from "react";
import { Input, TextField } from "react-aria-components";

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
    <TextField
      aria-label={ariaLabel}
      className={`${classNamePrefix}-field`}
      onChange={onChange}
      value={value}
    >
      <Input className={`${classNamePrefix}-input`} placeholder={placeholder} ref={inputRef} />
    </TextField>
  );
}
