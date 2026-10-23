import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("provides subtle press feedback while respecting reduced-motion preferences", () => {
    render(<Button>Save</Button>);

    expect(screen.getByRole("button", { name: "Save" })).toHaveClass(
      "active:scale-[0.98]",
      "duration-150",
      "motion-reduce:transition-none",
      "motion-reduce:active:scale-100"
    );
  });
});
