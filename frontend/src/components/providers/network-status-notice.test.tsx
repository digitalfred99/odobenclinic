import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NETWORK_FAILURE_EVENT, NETWORK_FAILURE_MESSAGE } from "@/lib/api";
import { NetworkStatusNotice } from "./network-status-notice";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("NetworkStatusNotice", () => {
  it("notifies when a request fails due to connectivity and can be dismissed", () => {
    render(<NetworkStatusNotice />);

    act(() => window.dispatchEvent(new Event(NETWORK_FAILURE_EVENT)));

    expect(screen.getByRole("alert")).toHaveTextContent(NETWORK_FAILURE_MESSAGE);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss connection notice" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("announces offline and restored connection states", () => {
    render(<NetworkStatusNotice />);

    act(() => window.dispatchEvent(new Event("offline")));
    expect(screen.getByRole("alert")).toHaveTextContent("You’re offline");

    act(() => window.dispatchEvent(new Event("online")));
    expect(screen.getByRole("status")).toHaveTextContent("Connection restored");
  });

  it("shows the offline notice when mounted without a connection", async () => {
    vi.stubGlobal("navigator", Object.create(window.navigator, {
      onLine: { configurable: true, value: false },
    }));
    render(<NetworkStatusNotice />);

    expect(await screen.findByRole("alert")).toHaveTextContent("You’re offline");
  });
});
