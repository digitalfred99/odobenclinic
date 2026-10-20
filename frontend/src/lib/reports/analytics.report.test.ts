import { describe, expect, it } from "vitest";
import { buildMaritalBreakdown, findDuplicates } from "./analytics";
import type { PatientRecord } from "./types";

const patient = (pid: string, nameKey: string | null, phoneKey: string | null): PatientRecord => ({
  pid,
  date: "2026-10-04",
  age: 30,
  sex: "female",
  area: "Osu",
  town: "Accra",
  district: "Accra Metro",
  region: "Greater Accra",
  hasPhone: Boolean(phoneKey),
  hasDob: Boolean(nameKey),
  hasGhCard: false,
  hasNhis: false,
  nameKey,
  phoneKey,
});

describe("possible duplicate groups", () => {
  it("merges overlapping name and phone matches without repeating patient IDs", () => {
    const result = findDuplicates([
      patient("PT-1/2026", "same-name-dob", null),
      patient("PT-2/2026", "same-name-dob", "shared-phone"),
      patient("PT-3/2026", null, "shared-phone"),
    ]);

    expect(result.groups).toEqual([{
      reasons: ["Same name and date of birth", "Same phone number"],
      pids: ["PT-1/2026", "PT-2/2026", "PT-3/2026"],
    }]);
    expect(result.pids.size).toBe(3);
  });
});

describe("marital status analysis", () => {
  it("counts recorded statuses and groups missing statuses as not recorded", () => {
    const rows = [
      { ...patient("PT-1/2026", null, null), maritalStatus: "married" as const },
      { ...patient("PT-2/2026", null, null), maritalStatus: "married" as const },
      patient("PT-3/2026", null, null),
    ];

    expect(buildMaritalBreakdown(rows)).toEqual([
      { status: "married", name: "Married", count: 2, share: 2 / 3 },
      { status: "unknown", name: "Not recorded", count: 1, share: 1 / 3 },
    ]);
  });
});
