import { describe, expect, it } from "vitest";
import { ApiError, NetworkError } from "@/lib/api";
import { shouldRetryQuery } from "./query-provider";

describe("shouldRetryQuery", () => {
  it("retries transient network and server failures at most twice", () => {
    expect(shouldRetryQuery(0, new TypeError("Network request failed"))).toBe(true);
    expect(shouldRetryQuery(0, new NetworkError())).toBe(true);
    expect(shouldRetryQuery(0, new ApiError("Database unavailable", 503))).toBe(true);
    expect(shouldRetryQuery(1, new ApiError("Database unavailable", 503))).toBe(true);
    expect(shouldRetryQuery(2, new ApiError("Database unavailable", 503))).toBe(false);
  });

  it("does not retry client errors or unrelated exceptions", () => {
    expect(shouldRetryQuery(0, new ApiError("Invalid request", 400))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError("Unauthorized", 401))).toBe(false);
    expect(shouldRetryQuery(0, new Error("Unexpected failure"))).toBe(false);
  });
});
