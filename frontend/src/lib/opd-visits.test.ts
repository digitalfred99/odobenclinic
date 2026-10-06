import { describe, expect, it } from "vitest";
import { buildOPDVisitQuery, getVisitDateRange } from "./opd-visits";

describe("OPD visit date filters", () => {
  const referenceDate = new Date(2026, 9, 4, 12);

  it("resolves day, week, month, and year presets to local inclusive dates", () => {
    expect(getVisitDateRange("today", referenceDate)).toEqual({ dateFrom: "2026-10-04", dateTo: "2026-10-04" });
    expect(getVisitDateRange("yesterday", referenceDate)).toEqual({ dateFrom: "2026-10-03", dateTo: "2026-10-03" });
    expect(getVisitDateRange("thisWeek", referenceDate)).toEqual({ dateFrom: "2026-09-28", dateTo: "2026-10-04" });
    expect(getVisitDateRange("thisMonth", referenceDate)).toEqual({ dateFrom: "2026-10-01", dateTo: "2026-10-31" });
    expect(getVisitDateRange("thisYear", referenceDate)).toEqual({ dateFrom: "2026-01-01", dateTo: "2026-12-31" });
  });

  it("builds only supported OPD list query parameters", () => {
    const query = buildOPDVisitQuery(" PT-12/2026 ", { dateFrom: "2026-10-01", dateTo: "2026-10-31" }, 2);
    expect(query).toBe("search=PT-12%2F2026&dateFrom=2026-10-01&dateTo=2026-10-31&page=2&limit=20");
  });
});
