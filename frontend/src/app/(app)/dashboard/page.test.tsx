import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import DashboardPage from "./page";

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn((path: string) => {
    if (path === "/dashboard") {
      return Promise.resolve({
        todayOPDVisits: 2,
        newPatientsToday: 1,
        returningPatientsToday: 1,
        totalRegisteredPatients: 30,
        recentOPDVisits: [],
      });
    }
    if (path.startsWith("/reports/patients")) {
      return Promise.resolve({
        rows: [{ patientId: "PT-1/2026" }, { patientId: "PT-2/2026" }],
        total: 2,
        pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
      });
    }
    if (path.includes("newReturning=new")) {
      return Promise.resolve({
        rows: [{ patientId: "PT-1/2026", date: "2026-10-10", newReturning: "new" }],
        total: 1,
        pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
      });
    }
    return Promise.resolve({
      rows: [
        { patientId: "PT-1/2026", date: "2026-10-10", newReturning: "new" },
        { patientId: "PT-3/2026", date: "2026-10-10", newReturning: "returning" },
      ],
      total: 2,
      pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
    });
  }),
}));

describe("DashboardPage", () => {
  it("shows primary registration actions and the weekly visit chart", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      const label = screen.getByText("New patient records");
      expect(label.parentElement?.parentElement).toHaveTextContent("1");
    });
    expect(await screen.findByRole("img", { name: /new and \d+ returning visits today/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Register new patient/ })).toHaveAttribute(
      "href",
      "/patients?register=new"
    );
    expect(screen.getByRole("link", { name: /Register OPD visit/ })).toHaveAttribute(
      "href",
      "/opd-visits/register"
    );

    expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining("/reports/patients?"), expect.anything());
    expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining("newReturning=new"), expect.anything());
  });
});
