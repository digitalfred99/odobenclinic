import { describe, expect, it } from "vitest";
import { buildWeeklyVisitSeries, countNewPatientsWithFirstVisit } from "./dashboard-analytics";

describe("countNewPatientsWithFirstVisit", () => {
  it("counts newly registered patients who had a first visit but excludes clinic archive entries", () => {
    expect(countNewPatientsWithFirstVisit(
      [{ patientId: "PT-1/2026" }, { patientId: "PT-2/2026" }],
      [{ patientId: "PT-1/2026" }, { patientId: "PT-1/2026" }]
    )).toBe(1);
  });
});

describe("buildWeeklyVisitSeries", () => {
  it("counts new and returning visits across the local seven-day window", () => {
    const today = new Date(2026, 9, 10, 12);
    const series = buildWeeklyVisitSeries([
      { date: "2026-10-04", newReturning: "new" },
      { date: "2026-10-09", newReturning: "returning" },
      { date: "2026-10-10", newReturning: "new" },
      { date: "2026-10-10", newReturning: "returning" },
      { date: "2026-10-11", newReturning: "new" },
    ], today);

    expect(series).toHaveLength(7);
    expect(series[0]).toMatchObject({ date: "2026-10-04", newVisits: 1, returningVisits: 0, total: 1 });
    expect(series[5]).toMatchObject({ date: "2026-10-09", newVisits: 0, returningVisits: 1, total: 1 });
    expect(series[6]).toMatchObject({ date: "2026-10-10", newVisits: 1, returningVisits: 1, total: 2 });
  });
});
