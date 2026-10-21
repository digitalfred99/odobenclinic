import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CloseButton } from "./close-button";

describe("CloseButton", () => {
  it("renders an accessibly named close control with the clinic close-button styling", () => {
    render(<CloseButton aria-label="Close dialog" onClick={vi.fn()} />);

    const button = screen.getByRole("button", { name: "Close dialog" });
    expect(button).toHaveClass(
      "min-h-10",
      "min-w-10",
      "rounded-full",
      "bg-card",
      "shadow-md",
      "hover:bg-muted"
    );
    expect(button.querySelector("svg")).toHaveClass("h-5", "w-5");
  });
});
