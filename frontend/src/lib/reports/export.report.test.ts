import { describe, expect, it } from "vitest";
import { fieldValue, getReportFields } from "./export";

describe("patient report exports", () => {
  it("offers all newly supported patient fields with readable column labels", () => {
    const fields = getReportFields("patients");

    expect(fields).toEqual(expect.arrayContaining([
      { key: "otherName", label: "Other name" },
      { key: "email", label: "Email" },
      { key: "postalAddress", label: "Postal address" },
      { key: "religion", label: "Religion" },
      { key: "occupation", label: "Occupation" },
    ]));
  });

  it("exports religion using its human-friendly label", () => {
    expect(fieldValue({ patientId: "PT-1/2026", name: "Ama Mensah", age: 34, gender: "female", area: null, religion: "christianity" }, "patients", "religion"))
      .toBe("Christianity");
  });
});
