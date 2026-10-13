import * as React from "react";
import { Input } from "@/components/ui/input";
import {
  getPhoneNumberError,
  PHONE_NUMBER_ERRORS,
  PHONE_NUMBER_PLACEHOLDER,
  sanitizePhoneNumber,
} from "@/lib/phone";

type PhoneInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "onBlur" | "onChange" | "inputMode" | "maxLength" | "pattern" | "placeholder" | "title" | "type"
> & {
  error?: string;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
};

export function PhoneInput({ error, onBlur, onChange, ref: forwardedRef, required, value, defaultValue, ...props }: PhoneInputProps) {
  const [hasInteracted, setHasInteracted] = React.useState(false);
  const [hasInvalidCharacters, setHasInvalidCharacters] = React.useState(false);
  const [hasRejectedLeadingDigit, setHasRejectedLeadingDigit] = React.useState(false);
  const [uncontrolledValue, setUncontrolledValue] = React.useState(
    typeof defaultValue === "string" ? sanitizePhoneNumber(defaultValue) : ""
  );
  const inputValue = typeof value === "string" ? sanitizePhoneNumber(value) : uncontrolledValue;
  const errorId = props.id ? `${props.id}-error` : undefined;
  const validationError = hasRejectedLeadingDigit
    ? PHONE_NUMBER_ERRORS.startsWithZero
    : hasInvalidCharacters
      ? PHONE_NUMBER_ERRORS.digitsOnly
      : hasInteracted
        ? getPhoneNumberError(inputValue, required)
        : null;
  const visibleError = error ?? validationError;
  const describedBy = [
    props["aria-describedby"],
    visibleError && errorId ? errorId : undefined,
  ].filter(Boolean).join(" ") || undefined;

  const inputRef = React.useRef<HTMLInputElement>(null);
  const setInputRef = React.useCallback((input: HTMLInputElement | null) => {
    inputRef.current = input;
    if (typeof forwardedRef === "function") {
      forwardedRef(input);
    } else if (forwardedRef) {
      forwardedRef.current = input;
    }
  }, [forwardedRef]);
  React.useEffect(() => {
    inputRef.current?.setCustomValidity(visibleError ?? "");
  }, [visibleError]);

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const enteredValue = event.currentTarget.value;
    const enteredDigits = enteredValue.replace(/\D/g, "").slice(0, 10);
    setHasInteracted(true);

    if (enteredDigits && !enteredDigits.startsWith("0")) {
      event.currentTarget.value = inputValue;
      setHasRejectedLeadingDigit(true);
      setHasInvalidCharacters(false);
      return;
    }

    const sanitizedValue = sanitizePhoneNumber(enteredValue);
    if (enteredValue !== sanitizedValue) {
      event.currentTarget.value = sanitizedValue;
    }
    setUncontrolledValue(sanitizedValue);
    setHasRejectedLeadingDigit(false);
    setHasInvalidCharacters(/\D/.test(enteredValue));
    onChange?.(event);
  };

  return (
    <div className="space-y-1">
      <Input
        {...props}
        ref={setInputRef}
        type="tel"
        inputMode="numeric"
        pattern="0[0-9]{9}"
        maxLength={10}
        required={required}
        autoComplete={props.autoComplete ?? "tel-national"}
        placeholder={PHONE_NUMBER_PLACEHOLDER}
        value={inputValue}
        aria-invalid={Boolean(visibleError) || props["aria-invalid"]}
        aria-describedby={describedBy}
        onChange={handleChange}
        onBlur={(event) => {
          setHasInteracted(true);
          onBlur?.(event);
        }}
      />
      {visibleError ? (
        <p id={errorId} className="text-sm text-destructive" aria-live="polite">
          {visibleError}
        </p>
      ) : null}
    </div>
  );
}