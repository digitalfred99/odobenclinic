import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PhoneInput } from "./phone-input";

describe("PhoneInput", () => {
  it("rejects a nonzero first digit and shows the leading-zero error while typing", () => {
    render(<PhoneInput id="phone" aria-label="Phone" />);

    const input = screen.getByLabelText("Phone");
    expect(input).toHaveAttribute("placeholder", "0XXXXXXXXX");
    fireEvent.change(input, { target: { value: "1" } });

    expect(input).toHaveValue("");
    expect(screen.getByText("Phone numbers must start with 0.")).toBeInTheDocument();
  });

  it("preserves the existing value when a replacement starts with a nonzero digit", () => {
    render(<PhoneInput id="phone" aria-label="Phone" />);

    const input = screen.getByLabelText("Phone");
    fireEvent.change(input, { target: { value: `0${"1".repeat(9)}` } });
    fireEvent.change(input, { target: { value: "1" } });

    expect(input).toHaveValue(`0${"1".repeat(9)}`);
    expect(screen.getByText("Phone numbers must start with 0.")).toBeInTheDocument();
  });

  it("strips non-digits and displays the shared length and numeric errors inline", () => {
    render(<PhoneInput id="phone" aria-label="Phone" />);

    const input = screen.getByLabelText("Phone");
    fireEvent.change(input, { target: { value: "0a" } });
    expect(input).toHaveValue("0");
    expect(screen.getByText("Phone numbers must contain digits only.")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "01" } });
    expect(screen.getByText("Phone numbers must be 10 digits.")).toBeInTheDocument();
  });

  it("shows the required error after leaving an empty required field", () => {
    render(<PhoneInput id="phone" aria-label="Phone" required />);

    fireEvent.blur(screen.getByLabelText("Phone"));

    expect(screen.getByText("Phone number is required.")).toBeInTheDocument();
  });
});
