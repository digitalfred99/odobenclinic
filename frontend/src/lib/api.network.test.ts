import { afterEach, describe, expect, it, vi } from "vitest";
import {
  apiRequest,
  NETWORK_FAILURE_EVENT,
  NETWORK_FAILURE_MESSAGE,
} from "./api";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("API network failures", () => {
  it("surfaces a clear connection error and notifies the app", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const onNetworkFailure = vi.fn();
    window.addEventListener(NETWORK_FAILURE_EVENT, onNetworkFailure);

    await expect(apiRequest("/patients", {}, { auth: false }))
      .rejects.toMatchObject({
        name: "NetworkError",
        message: NETWORK_FAILURE_MESSAGE,
      });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(onNetworkFailure).toHaveBeenCalledOnce();
    window.removeEventListener(NETWORK_FAILURE_EVENT, onNetworkFailure);
  });

  it("does not misreport aborted requests as connection failures", async () => {
    const abortError = new DOMException("The operation was aborted.", "AbortError");
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(abortError);
    const onNetworkFailure = vi.fn();
    window.addEventListener(NETWORK_FAILURE_EVENT, onNetworkFailure);

    await expect(apiRequest("/patients", {}, { auth: false })).rejects.toBe(abortError);
    expect(onNetworkFailure).not.toHaveBeenCalled();
    window.removeEventListener(NETWORK_FAILURE_EVENT, onNetworkFailure);
  });
});
