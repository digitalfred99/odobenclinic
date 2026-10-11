"use client";

import { ChevronDown } from "lucide-react";
import { useRef, useState, type KeyboardEvent, type Ref } from "react";

type LocationComboboxProps = {
  id: string;
  value: string;
  options: readonly string[];
  placeholder: string;
  suggestionsLabel: string;
  inputRef?: Ref<HTMLInputElement>;
  onChange: (value: string) => void;
  onBlur?: () => void;
};

export function LocationCombobox({
  id,
  value,
  options,
  placeholder,
  suggestionsLabel,
  inputRef,
  onChange,
  onBlur,
}: LocationComboboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [showAllOptions, setShowAllOptions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const filteredOptions = showAllOptions
    ? options
    : options.filter((option) => option.toLowerCase().includes(value.toLowerCase()));

  const selectOption = (option: string) => {
    onChange(option);
    setIsOpen(false);
    setShowAllOptions(false);
    setActiveIndex(0);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && filteredOptions.length > 0) {
      event.preventDefault();
      if (!isOpen) {
        setActiveIndex(0);
      } else {
        setActiveIndex((current) => Math.min(current + 1, filteredOptions.length - 1));
      }
      setIsOpen(true);
    } else if (event.key === "ArrowUp" && isOpen && filteredOptions.length > 0) {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && isOpen && filteredOptions[activeIndex]) {
      event.preventDefault();
      selectOption(filteredOptions[activeIndex]);
    } else if (event.key === "Escape") {
      setIsOpen(false);
      setShowAllOptions(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node | null)) {
          setIsOpen(false);
          setShowAllOptions(false);
          onBlur?.();
        }
      }}
    >
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={`${id}-listbox`}
          aria-activedescendant={isOpen && filteredOptions[activeIndex] ? `${id}-option-${activeIndex}` : undefined}
          placeholder={placeholder}
          autoComplete="off"
          value={value}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            onChange(event.target.value);
            setShowAllOptions(false);
            setActiveIndex(0);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="flex h-11 w-full rounded-md border border-border bg-background py-2 pl-3 pr-12 text-base text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-sm"
        />
        <button
          type="button"
          aria-label={suggestionsLabel}
          aria-expanded={isOpen}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setShowAllOptions((show) => !isOpen || !show);
            setIsOpen((open) => !open || !showAllOptions);
            setActiveIndex(0);
          }}
          className="absolute inset-y-0 right-0 flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-r-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {isOpen ? (
        <div
          id={`${id}-listbox`}
          role="listbox"
          aria-label={suggestionsLabel}
          className="absolute left-0 top-full z-50 mt-1 max-h-72 w-full overflow-y-auto overscroll-contain rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {filteredOptions.length > 0 ? filteredOptions.map((option, index) => (
            <div
              id={`${id}-option-${index}`}
              key={option}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectOption(option)}
              className="flex min-h-11 cursor-pointer items-center rounded-md px-3 py-2 text-base outline-none hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground sm:text-sm"
            >
              {option}
            </div>
          )) : (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              No matches. Keep typing to use a custom value.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
