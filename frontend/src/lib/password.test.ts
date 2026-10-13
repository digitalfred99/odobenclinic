import { describe, expect, it } from "vitest";
import { isStrongPassword } from "./password";

describe("isStrongPassword", () => {
  it("requires eight characters, a number, and a special character", () => {
    expect(isStrongPassword("Clinic123!")).toBe(true);
    expect(isStrongPassword("short1!")).toBe(false);
    expect(isStrongPassword("ClinicPass!")).toBe(false);
    expect(isStrongPassword("Clinic1234")).toBe(false);
  });
});
