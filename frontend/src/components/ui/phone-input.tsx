import * as React from "react";
import { Input } from "@/components/ui/input";
import { sanitizePhoneNumber } from "@/lib/phone";

type PhoneInputProps = Omit<React.ComponentProps<typeof Input>, "onChange" | "type"> & {
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
};

export function PhoneInput({ onChange, value, defaultValue, ...props }: PhoneInputProps) {
  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const sanitizedValue = sanitizePhoneNumber(event.currentTarget.value);
    if (event.currentTarget.value !== sanitizedValue) {
      event.currentTarget.value = sanitizedValue;
    }
    onChange?.(event);
  };

  return (
    <Input
      {...props}
      type="tel"
      inputMode="numeric"
      pattern="0[0-9]{9}"
      maxLength={10}
      autoComplete={props.autoComplete ?? "tel-national"}
      title="Enter 10 digits starting with 0."
      value={typeof value === "string" ? sanitizePhoneNumber(value) : value}
      defaultValue={typeof defaultValue === "string" ? sanitizePhoneNumber(defaultValue) : defaultValue}
      onChange={handleChange}
    />
  );
}