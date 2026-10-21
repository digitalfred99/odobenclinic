import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HealthLoadingScreen } from "./health-loading-screen";

describe("HealthLoadingScreen", () => {
  it("renders the branded heartbeat loading state accessibly", () => {
    render(<HealthLoadingScreen label="Loading session" />);

    expect(screen.getByRole("status", { name: "Loading session" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Odoben Health Center")).toBeInTheDocument();
    expect(screen.getByText("Preparing your care workspace")).toBeInTheDocument();
    expect(document.querySelector(".health-heartbeat")).toBeInTheDocument();
    expect(document.querySelectorAll(".health-pulse-ring")).toHaveLength(2);
  });
});
