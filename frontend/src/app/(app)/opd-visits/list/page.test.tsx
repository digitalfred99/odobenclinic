import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import OPDVisitListPage from "./page";

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn().mockResolvedValue({ opdVisits: [], pagination: { total: 0, totalPages: 1 } }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function renderVisitList() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <OPDVisitListPage />
    </QueryClientProvider>
  );
}

describe("OPD visit list filters", () => {
  it("shows visit-card skeletons while visits are loading", () => {
    vi.mocked(apiRequest).mockReturnValue(new Promise(() => {}));
    renderVisitList();

    expect(screen.getByRole("status", { name: "Loading OPD visits" })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Loading OPD visits...")).not.toBeInTheDocument();
  });

  it("applies supported visit-date preset and free-text search parameters", async () => {
    renderVisitList();

    fireEvent.change(screen.getByRole("textbox", { name: /search opd visits/i }), {
      target: { value: "PT-12/2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.change(screen.getByLabelText("Visit date"), { target: { value: "thisMonth" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        expect.stringMatching(/^\/opd-visits\?search=PT-12%2F2026&dateFrom=\d{4}-\d{2}-\d{2}&dateTo=\d{4}-\d{2}-\d{2}&page=1&limit=20$/),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
    expect(screen.getByRole("button", { name: "Filters (1)" })).toBeInTheDocument();
  });
});
