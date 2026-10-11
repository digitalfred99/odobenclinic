import { describe, expect, it } from "vitest";
import { patientFormSchema } from "./patient";

const minimumPatient = {
  firstName: "Ama",
  lastName: "Mensah",
  gender: "female",
};

describe("patient form validation", () => {
  it("accepts a valid Ghanaian phone number and required marital status", () => {
    expect(patientFormSchema.safeParse({
      ...minimumPatient,
      age: "34",
      phone: "0241234567",
      maritalStatus: "single",
    }).success).toBe(true);
  });

  it("requires marital status", () => {
    expect(patientFormSchema.safeParse({
      ...minimumPatient,
      age: "34",
    }).success).toBe(false);
  });
  it("requires a phone number to start with zero when provided", () => {
    const result = patientFormSchema.safeParse({
      ...minimumPatient,
      age: "34",
      phone: "1241234567",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes("start with 0"))).toBe(true);
    }
  });

  it("requires gender and either date of birth or age", () => {
    const result = patientFormSchema.safeParse({
      firstName: "Ama",
      lastName: "Mensah",
      gender: "",
      maritalStatus: "single",
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
});
