import { describe, expect, it } from "vitest";
import { formatPatientName } from "./patient-name";

describe("formatPatientName", () => {
  it("includes the other name when present", () => {
    expect(formatPatientName({ firstName: "Ama", otherName: "Yaa", lastName: "Mensah" })).toBe("Ama Yaa Mensah");
  });

  it("omits missing or blank name parts", () => {
    expect(formatPatientName({ firstName: "Ama", otherName: "  ", lastName: "Mensah" })).toBe("Ama Mensah");
  });
});