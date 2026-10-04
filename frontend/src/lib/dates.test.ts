import { describe, expect, it } from "vitest";
import { calculateAge, getDateOfBirthError } from "./dates";

describe("calculateAge", () => {
  it("calculates the current age from a valid date of birth", () => {
    const today = new Date();
    const birthDate = new Date(today.getFullYear() - 25, today.getMonth(), today.getDate());

    expect(calculateAge(birthDate.toISOString().slice(0, 10))).toBe(25);
  });

  it("returns null for an invalid date value", () => {
    expect(calculateAge("not-a-date")).toBeNull();
  });
});

describe("getDateOfBirthError", () => {
  const today = "2026-10-03";

  it("rejects malformed and impossible calendar dates", () => {
    expect(getDateOfBirthError("12/34/2344566", today)).toBe("Enter the date in YYYY-MM-DD format.");
    expect(getDateOfBirthError("2026-02-29", today)).toBe("Enter a valid calendar date.");
  });

  it("rejects future dates and dates older than 130 years", () => {
    expect(getDateOfBirthError("2026-10-04", today)).toBe("Date of birth cannot be in the future.");
    expect(getDateOfBirthError("1896-10-02", today)).toBe("Date of birth cannot be more than 130 years ago.");
  });

  it("accepts a valid past calendar date within the allowed age range", () => {
    expect(getDateOfBirthError("2000-02-29", today)).toBeNull();
    expect(getDateOfBirthError("1896-10-03", today)).toBeNull();
  });
});
