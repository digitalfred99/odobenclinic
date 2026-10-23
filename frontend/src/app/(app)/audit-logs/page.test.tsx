import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AuditLogsPage from "./page";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isLoading: false, error: null }),
}));

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
}));

describe("audit log filters", () => {
  it("associates each visible filter label with its native control", () => {
    render(<AuditLogsPage />);

    expect(screen.getByLabelText("Action").tagName).toBe("SELECT");
    expect(screen.getByLabelText("Entity").tagName).toBe("SELECT");
    expect(screen.getByLabelText("From")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("To")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("Actor ID")).toHaveAttribute("placeholder", "UUID");
  });
});
