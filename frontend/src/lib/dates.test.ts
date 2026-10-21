import { describe, expect, it } from "vitest";
import { calculateAge, getDateOfBirthError, getOpdVisitDateError, toLocalInputDate } from "./dates";

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

  describe("local OPD visit dates", () => {
    it("formats the current local calendar date without converting through UTC", () => {
      expect(toLocalInputDate(new Date(2026, 9, 20, 23, 30))).toBe("2026-10-20");
    });

    it("rejects future and invalid dates while allowing late data entry", () => {
      expect(getOpdVisitDateError("2026-10-21", "2026-10-20")).toBe("Visit date cannot be in the future.");
      expect(getOpdVisitDateError("2026-02-30", "2026-10-20")).toBe("Enter a valid visit date.");
      expect(getOpdVisitDateError("2026-10-19", "2026-10-20")).toBeNull();
    });
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
