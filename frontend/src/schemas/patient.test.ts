import { describe, expect, it } from "vitest";
import { toLocalInputDate } from "@/lib/dates";
import {
  clinicRecordPatientFormSchema,
  patientFormSchema,
  patientWithOpdFormSchema,
} from "./patient";

const minimumPatient = {
  firstName: "Ama",
  lastName: "Mensah",
  gender: "female",
  religion: "christianity",
};

describe("patient form validation", () => {
  it("accepts a valid Ghanaian phone number and required marital status", () => {
    expect(patientFormSchema.safeParse({
      ...minimumPatient,
      age: "34",
      phone: "0".repeat(10),
      maritalStatus: "single",
    }).success).toBe(true);
  });

  it("requires marital status", () => {
    expect(patientFormSchema.safeParse({
      ...minimumPatient,
      age: "34",
    }).success).toBe(false);
  });

  it("requires a valid religion and validates the optional contact fields", () => {
    const base = { ...minimumPatient, age: "34", maritalStatus: "single" };
    expect(patientFormSchema.safeParse({ ...base, religion: "" }).success).toBe(false);
    expect(patientFormSchema.safeParse({
      ...base,
      email: "not-an-email",
      postalAddress: "x".repeat(101),
      occupation: "x".repeat(101),
    }).success).toBe(false);
    expect(patientFormSchema.safeParse({
      ...base,
      email: "ama@example.com",
      postalAddress: "P.O. Box 10",
      occupation: "Teacher",
    }).success).toBe(true);
  });
  it("requires a phone number to start with zero when provided", () => {
    const result = patientFormSchema.safeParse({
      ...minimumPatient,
      age: "34",
      phone: "1".repeat(10),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message === "Phone numbers must start with 0.")).toBe(true);
    }
  });

  it("uses shared length and numeric phone validation messages", () => {
    const tooShort = patientFormSchema.safeParse({
      ...minimumPatient,
      age: "34",
      phone: "0".repeat(9),
      maritalStatus: "single",
    });
    const nonNumeric = patientFormSchema.safeParse({
      ...minimumPatient,
      age: "34",
      phone: "0abcdefghi",
      maritalStatus: "single",
    });

    expect(tooShort.success).toBe(false);
    expect(nonNumeric.success).toBe(false);
    if (!tooShort.success && !nonNumeric.success) {
      expect(tooShort.error.issues.some((issue) => issue.message === "Phone numbers must be 10 digits.")).toBe(true);
      expect(nonNumeric.error.issues.some((issue) => issue.message === "Phone numbers must contain digits only.")).toBe(true);
    }
  });

  it("requires gender and either date of birth or age", () => {
    const result = patientFormSchema.safeParse({
      firstName: "Ama",
      lastName: "Mensah",
      gender: "",
      maritalStatus: "single",
      religion: "christianity",
      age: "",
      dateOfBirth: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining(["Gender is required", "Provide either a date of birth or an age."])
      );
    }
  });

  it("rejects non-numeric manual ages", () => {
    expect(patientFormSchema.safeParse({
      ...minimumPatient,
      age: "adult",
    }).success).toBe(false);
  });

  it("requires a non-future visit date for the with-OPD registration flow", () => {
    const base = { ...minimumPatient, age: "34", maritalStatus: "single" };
    const today = toLocalInputDate();
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = toLocalInputDate(tomorrowDate);
    expect(patientWithOpdFormSchema.safeParse({
      ...base,
      visitDate: tomorrow,
    }).success).toBe(false);
    expect(patientWithOpdFormSchema.safeParse({
      ...base,
      visitDate: today,
      visitRemarks: "Late entry",
    }).success).toBe(true);
  });

  it("requires a bounded whole-year manual number for clinic-record entries", () => {
    const base = { ...minimumPatient, age: "34", maritalStatus: "single" };
    expect(clinicRecordPatientFormSchema.safeParse({
      ...base,
      year: "1999",
      positionInYear: "45",
    }).success).toBe(false);
    expect(clinicRecordPatientFormSchema.safeParse({
      ...base,
      year: "2026",
      positionInYear: "45",
    }).success).toBe(true);
    expect(clinicRecordPatientFormSchema.safeParse({
      ...base,
      year: "2026.5",
      positionInYear: "45",
    }).success).toBe(false);
  });
});
