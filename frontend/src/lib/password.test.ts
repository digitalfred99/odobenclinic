import { describe, expect, it } from "vitest";
import {
  getPasswordPolicyError,
  getAuthPasswordRequirements,
  getPasswordRequirements,
  isStrongPassword,
  isUserPasswordValid,
} from "./password";

describe("isStrongPassword", () => {
  it("preserves the auth password checks", () => {
    expect(isStrongPassword("Clinic123!")).toBe(true);
    expect(isStrongPassword("short1!")).toBe(false);
    expect(isStrongPassword("CLINIC123!")).toBe(false);
    expect(isStrongPassword("clinic123!")).toBe(false);
    expect(isStrongPassword("ClinicPass!")).toBe(false);
    expect(isStrongPassword("Clinic1234")).toBe(false);
    expect(isStrongPassword("Clinic123🙂")).toBe(false);
    expect(isStrongPassword("Clinic123_")).toBe(false);
    expect(isStrongPassword("Clinic 123!")).toBe(false);
    expect(isStrongPassword(`${"a".repeat(71)}A1!`)).toBe(false);
  });

  it("matches the staff user password rules", () => {
    expect(isUserPasswordValid("Clinic123!")).toBe(true);
    expect(isUserPasswordValid("short1!")).toBe(false);
    expect(isUserPasswordValid("clinic123!")).toBe(false);
    expect(isUserPasswordValid("CLINIC123!")).toBe(false);
    expect(isUserPasswordValid("ClinicPass!")).toBe(false);
    expect(isUserPasswordValid("Clinic1234")).toBe(false);
    expect(isUserPasswordValid("Clinic 123!")).toBe(false);
    expect(isUserPasswordValid(`${"a".repeat(69)}A1!`)).toBe(true);
    expect(isUserPasswordValid(`${"a".repeat(71)}A1!`)).toBe(false);
  });

  it("reports explicit whitespace and maximum-length policy errors", () => {
    expect(getPasswordPolicyError("Clinic 123!")).toBe("Password must not contain spaces.");
    expect(getPasswordPolicyError(`${"a".repeat(71)}A1!`)).toBe("Password must not exceed 72 characters.");
    expect(getPasswordPolicyError("Clinic123!")).toBeNull();
  });

  it("reports each password requirement independently", () => {
    const requirements = getPasswordRequirements("Clinic123!");

    expect(requirements.map(({ label, met }) => [label, met])).toEqual([
      ["At least 8 characters", true],
      ["At least one lowercase letter", true],
      ["At least one uppercase letter", true],
      ["At least one number", true],
      ["At least one special character", true],
    ]);
  });

  it("reports only the auth password requirements", () => {
    const requirements = getAuthPasswordRequirements("lowercase123!");

    expect(requirements.map(({ label, met }) => [label, met])).toEqual([
      ["At least 8 characters", true],
      ["At least one lowercase letter", true],
      ["At least one uppercase letter", false],
      ["At least one number", true],
      ["At least one special character", true],
    ]);
  });

  it("only accepts special characters allowed by the backend", () => {
    expect(isUserPasswordValid("Clinic123!")).toBe(true);
    expect(isUserPasswordValid("Clinic123🙂")).toBe(false);
  });
});
