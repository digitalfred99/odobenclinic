import { describe, expect, it } from "vitest";
import { isTenDigitPhoneNumber, sanitizePhoneNumber } from "./phone";

describe("phone number helpers", () => {
  it("keeps only the first ten digits", () => {
    expect(sanitizePhoneNumber("(024) 123-4567 ext 8")).toBe("0241234567");
    expect(sanitizePhoneNumber("1234567890123")).toBe("1234567890");
  });

  it("accepts only exactly ten digits", () => {
    expect(isTenDigitPhoneNumber("0241234567")).toBe(true);
    expect(isTenDigitPhoneNumber("024123456")).toBe(false);
    expect(isTenDigitPhoneNumber("02412345678")).toBe(false);
    expect(isTenDigitPhoneNumber("024-1234567")).toBe(false);
  });
});