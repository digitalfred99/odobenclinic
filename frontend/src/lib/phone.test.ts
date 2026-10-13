import { describe, expect, it } from "vitest";
import {
  getPhoneNumberError,
  isTenDigitPhoneNumber,
  PHONE_NUMBER_ERRORS,
  PHONE_NUMBER_PLACEHOLDER,
  sanitizePhoneNumber,
} from "./phone";

const VALID_PHONE = "0".concat("1".repeat(9));

describe("phone number helpers", () => {
  it("keeps only the first ten digits and rejects values without a leading zero", () => {
    expect(sanitizePhoneNumber("(0) 111-1111-11 ext 8")).toBe(VALID_PHONE);
    expect(sanitizePhoneNumber("1".repeat(13))).toBe("");
    expect(sanitizePhoneNumber(`${VALID_PHONE}1`)).toBe(VALID_PHONE);
    expect(sanitizePhoneNumber("1".repeat(10))).toBe("");
  });

  it("accepts exactly ten digits starting with zero", () => {
    expect(isTenDigitPhoneNumber(VALID_PHONE)).toBe(true);
    expect(isTenDigitPhoneNumber("1".repeat(10))).toBe(false);
    expect(isTenDigitPhoneNumber("0".repeat(9))).toBe(false);
    expect(isTenDigitPhoneNumber("0".repeat(11))).toBe(false);
    expect(isTenDigitPhoneNumber(`0-${"1".repeat(9)}`)).toBe(false);
  });

  it("returns the same inline errors for leading digit, length, numeric and required validation", () => {
    expect(getPhoneNumberError("1")).toBe(PHONE_NUMBER_ERRORS.startsWithZero);
    expect(getPhoneNumberError("01")).toBe(PHONE_NUMBER_ERRORS.length);
    expect(getPhoneNumberError("0abcdefghi")).toBe(PHONE_NUMBER_ERRORS.digitsOnly);
    expect(getPhoneNumberError("", true)).toBe(PHONE_NUMBER_ERRORS.required);
    expect(getPhoneNumberError("")).toBeNull();
    expect(PHONE_NUMBER_PLACEHOLDER).toBe("0XXXXXXXXX");
  });
});