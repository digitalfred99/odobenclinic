import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { patientFormSchema } from "@/schemas/patient";
import { GhCardNumberInput, NhisNumberInput } from "./patient-identifier-inputs";

function GhCardHarness({ initialValue = "" }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return <GhCardNumberInput aria-label="Ghana Card number" value={value} onChange={setValue} />;
}

function NhisHarness() {
  const [value, setValue] = useState("");
  return <NhisNumberInput aria-label="NHIS number" value={value} onChange={setValue} />;
}

describe("patient identifier inputs", () => {
  it("rejects non-digit keystrokes in the NHIS field and strips non-digits from paste", () => {
    render(<NhisHarness />);
    const input = screen.getByRole("textbox", { name: "NHIS number" }) as HTMLInputElement;

    expect(fireEvent.keyDown(input, { key: "x" })).toBe(false);
    expect(input).toHaveValue("");
    fireEvent.paste(input, { clipboardData: { getData: () => "56a 738-94501" } });
    expect(input).toHaveValue("56738945");
  });

  it("formats Ghana Card digits, blocks invalid keys, and removes a digit at the separator on backspace", () => {
    render(<GhCardHarness />);
    const input = screen.getByRole("textbox", { name: "Ghana Card number" }) as HTMLInputElement;

    expect(input).toHaveValue("GHA-");
    expect(fireEvent.keyDown(input, { key: "x" })).toBe(false);
    fireEvent.change(input, { target: { value: "GHA-1234567890" } });
    expect(input).toHaveValue("GHA-123456789-0");
    input.setSelectionRange(14, 14);
    expect(fireEvent.keyDown(input, { key: "Backspace" })).toBe(false);
    expect(input).toHaveValue("GHA-123456780-");
  });

  it("accepts a preformatted Ghana Card value and raw digits from paste", () => {
    render(<GhCardHarness />);
    const input = screen.getByRole("textbox", { name: "Ghana Card number" }) as HTMLInputElement;

    fireEvent.paste(input, { clipboardData: { getData: () => "GHA-123 456 789-0" } });
    expect(input).toHaveValue("GHA-123456789-0");
    input.setSelectionRange(4, input.value.length);
    fireEvent.paste(input, { clipboardData: { getData: () => "9876543210" } });
    expect(input).toHaveValue("GHA-987654321-0");
  });

  it("formats an already formatted value from the patient record", () => {
    render(<GhCardHarness initialValue="GHA-123456789-0" />);
    expect(screen.getByRole("textbox", { name: "Ghana Card number" })).toHaveValue("GHA-123456789-0");
  });

  it("accepts empty identifiers and validates the exact requested formats", () => {
    const baseValues = { firstName: "Ama", lastName: "Mensah", age: 30 };

    expect(patientFormSchema.safeParse({ ...baseValues, ghCardNumber: "", nhisNumber: "" }).success).toBe(true);
    expect(patientFormSchema.safeParse({ ...baseValues, ghCardNumber: "GHA-123456789-0", nhisNumber: "56738945" }).success).toBe(true);
    expect(patientFormSchema.safeParse({ ...baseValues, ghCardNumber: "GHA-123456789", nhisNumber: "5673894" }).success).toBe(false);
    expect(patientFormSchema.safeParse({ ...baseValues, ghCardNumber: "", nhisNumber: "5673894x" }).success).toBe(false);
  });
});