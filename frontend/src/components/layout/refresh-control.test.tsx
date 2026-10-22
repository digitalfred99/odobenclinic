import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RefreshControl } from "./refresh-control";

const navigation = vi.hoisted(() => ({ pathname: "/patients" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

function renderRefreshControl(queryFn: (context: { signal: AbortSignal }) => Promise<string>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function ActiveQuery() {
    useQuery({ queryKey: ["active-page"], queryFn });
    return null;
  }

  const view = render(
    <QueryClientProvider client={queryClient}>
      <ActiveQuery />
      <RefreshControl />
    </QueryClientProvider>
  );

  return {
    ...view,
    queryClient,
    rerenderPage: () => view.rerender(
      <QueryClientProvider client={queryClient}>
        <ActiveQuery />
        <RefreshControl />
      </QueryClientProvider>
    ),
  };
}

describe("RefreshControl", () => {
  beforeEach(() => {
    navigation.pathname = "/patients";
  });

  it("refetches active page queries", async () => {
    const queryFn = vi.fn().mockResolvedValue("fresh");
    renderRefreshControl(queryFn);
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Refresh page data" }));

    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Page data refreshed.")).toBeInTheDocument();
  });

  it("applies the page content width when provided", () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <RefreshControl className="max-w-6xl" />
      </QueryClientProvider>
    );

    expect(screen.getByRole("button", { name: "Refresh page data" }).parentElement).toHaveClass(
      "mx-auto",
      "max-w-6xl"
    );
  });

  it("shows a clear message when an active query cannot refresh", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce("cached").mockRejectedValueOnce(new Error("Database unavailable"));
    renderRefreshControl(queryFn);
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Refresh page data" }));

    expect(await screen.findByText("Some data could not be refreshed. Please try again.")).toBeInTheDocument();
  });

  it("does not report an expected query cancellation as a refresh failure", async () => {
    const queryFn = vi.fn()
      .mockResolvedValueOnce("cached")
      .mockImplementationOnce(({ signal }: { signal: AbortSignal }) => new Promise<string>((resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      }));
    const { queryClient } = renderRefreshControl(queryFn);
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Refresh page data" }));
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    await queryClient.cancelQueries({ queryKey: ["active-page"] });

    expect(await screen.findByText("Page data refreshed.")).toBeInTheDocument();
    expect(screen.queryByText("Some data could not be refreshed. Please try again.")).not.toBeInTheDocument();
  });

  it("clears the result when navigating and ignores an old refresh completion", async () => {
    let resolveRefresh: ((value: string) => void) | undefined;
    const queryFn = vi.fn()
      .mockResolvedValueOnce("initial")
      .mockImplementationOnce(() => new Promise((resolve) => { resolveRefresh = resolve; }));
    const view = renderRefreshControl(queryFn);
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Refresh page data" }));
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    navigation.pathname = "/users";
    view.rerenderPage();

    expect(screen.queryByText("Page data refreshed.")).not.toBeInTheDocument();
    resolveRefresh?.("old page response");
    await waitFor(() => expect(screen.getByRole("button", { name: "Refresh page data" })).toBeEnabled());
    expect(screen.queryByText("Page data refreshed.")).not.toBeInTheDocument();
  });
});
