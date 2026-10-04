import * as React from "react";
import { Input, type InputProps } from "./input";

type IdentifierInputProps = Omit<
  InputProps,
  "value" | "onChange" | "onBlur" | "onKeyDown" | "onPaste" | "maxLength" | "inputMode"
> & {
  value?: string;
  onChange: (value: string) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  inputRef?: React.RefCallback<HTMLInputElement>;
};

function useSetCaretAfterRender(
  inputRef: React.RefObject<HTMLInputElement | null>,
  pendingCaret: React.MutableRefObject<number | null>,
  value: string
) {
  React.useLayoutEffect(() => {
    const input = inputRef.current;
    const caret = pendingCaret.current;
    if (input && caret !== null) {
      input.setSelectionRange(caret, caret);
      pendingCaret.current = null;
    }
  }, [inputRef, pendingCaret, value]);
}

function setInputRef(
  internalRef: React.RefObject<HTMLInputElement | null>,
  externalRef: React.RefCallback<HTMLInputElement> | undefined,
  input: HTMLInputElement | null
) {
  internalRef.current = input;
  externalRef?.(input);
}

function formatGhCardNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  return `GHA-${digits.slice(0, 9)}${digits.length >= 9 ? "-" : ""}${digits.slice(9)}`;
}

function digitOffset(value: string, position: number) {
  return value.slice(4, position).replace(/\D/g, "").length;
}

function ghCardCaretPosition(digitsBeforeCaret: number) {
  return 4 + Math.min(digitsBeforeCaret, 9) + (digitsBeforeCaret >= 9 ? 1 : 0);
}

function isEditingShortcut(event: React.KeyboardEvent<HTMLInputElement>) {
  return event.ctrlKey || event.metaKey || event.altKey;
}

export function GhCardNumberInput({ value = "", onChange, onBlur, inputRef: externalRef, ...props }: IdentifierInputProps) {
  const internalRef = React.useRef<HTMLInputElement>(null);
  const pendingCaret = React.useRef<number | null>(null);
  const displayValue = formatGhCardNumber(value);
  useSetCaretAfterRender(internalRef, pendingCaret, displayValue);

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const inputValue = event.currentTarget.value;
    const selectionStart = event.currentTarget.selectionStart ?? inputValue.length;
    const digits = inputValue.replace(/\D/g, "").slice(0, 10);
    const digitsBeforeCaret = digitOffset(inputValue, selectionStart);
    pendingCaret.current = ghCardCaretPosition(Math.min(digitsBeforeCaret, digits.length));
    onChange(formatGhCardNumber(digits));
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
    const input = event.currentTarget;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;
    const digits = displayValue.replace(/\D/g, "");

    if (event.key === "Backspace" && start === end && start === 14 && digits.length >= 9) {
      event.preventDefault();
      const nextDigits = `${digits.slice(0, 8)}${digits.slice(9)}`;
      pendingCaret.current = ghCardCaretPosition(8);
      onChange(formatGhCardNumber(nextDigits));
      return;
    }

    if (!isEditingShortcut(event) && event.key.length === 1 && !/\d/.test(event.key)) {
      event.preventDefault();
      return;
    }

    if (event.key === "Backspace" && start === end && start <= 4) {
      event.preventDefault();
      return;
    }

    if (event.key === "Delete" && start === end && start === 13) {
      event.preventDefault();
      return;
    }

    if (event.key === "Delete" && start === end && start < 4) {
      event.preventDefault();
      return;
    }

    const selectedDigits = digitOffset(displayValue, end) - digitOffset(displayValue, start);
    if (/^\d$/.test(event.key) && digits.length >= 10 && selectedDigits === 0) {
      event.preventDefault();
    }
  };

  const handlePaste: React.ClipboardEventHandler<HTMLInputElement> = (event) => {
    event.preventDefault();
    const input = event.currentTarget;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const startOffset = digitOffset(input.value, start);
    const endOffset = digitOffset(input.value, end);
    const currentDigits = displayValue.replace(/\D/g, "");
    const pastedDigits = event.clipboardData.getData("text").replace(/\D/g, "");
    const nextDigits = `${currentDigits.slice(0, startOffset)}${pastedDigits}${currentDigits.slice(endOffset)}`.slice(0, 10);
    const caretDigits = Math.min(startOffset + pastedDigits.length, nextDigits.length);
    pendingCaret.current = ghCardCaretPosition(caretDigits);
    onChange(formatGhCardNumber(nextDigits));
  };

  return (
    <Input
      {...props}
      ref={(input) => setInputRef(internalRef, externalRef, input)}
      type="text"
      inputMode="numeric"
      maxLength={15}
      value={displayValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onBlur={onBlur}
    />
  );
}

export function NhisNumberInput({ value = "", onChange, onBlur, inputRef: externalRef, ...props }: IdentifierInputProps) {
  const internalRef = React.useRef<HTMLInputElement>(null);
  const pendingCaret = React.useRef<number | null>(null);
  const displayValue = value.replace(/\D/g, "").slice(0, 8);
  useSetCaretAfterRender(internalRef, pendingCaret, displayValue);

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const inputValue = event.currentTarget.value;
    const selectionStart = event.currentTarget.selectionStart ?? inputValue.length;
    const digits = inputValue.replace(/\D/g, "").slice(0, 8);
    pendingCaret.current = Math.min(inputValue.slice(0, selectionStart).replace(/\D/g, "").length, digits.length);
    onChange(digits);
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (!isEditingShortcut(event) && event.key.length === 1 && !/\d/.test(event.key)) {
      event.preventDefault();
      return;
    }

    const input = event.currentTarget;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;
    if (/^\d$/.test(event.key) && displayValue.length >= 8 && start === end) {
      event.preventDefault();
    }
  };

  const handlePaste: React.ClipboardEventHandler<HTMLInputElement> = (event) => {
    event.preventDefault();
    const input = event.currentTarget;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const startOffset = input.value.slice(0, start).replace(/\D/g, "").length;
    const endOffset = input.value.slice(0, end).replace(/\D/g, "").length;
    const pastedDigits = event.clipboardData.getData("text").replace(/\D/g, "");
    const nextDigits = `${displayValue.slice(0, startOffset)}${pastedDigits}${displayValue.slice(endOffset)}`.slice(0, 8);
    pendingCaret.current = Math.min(startOffset + pastedDigits.length, nextDigits.length);
    onChange(nextDigits);
  };

  return (
    <Input
      {...props}
      ref={(input) => setInputRef(internalRef, externalRef, input)}
      type="text"
      inputMode="numeric"
      maxLength={8}
      value={displayValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onBlur={onBlur}
    />
  );
}