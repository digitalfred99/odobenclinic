import { describe, expect, it } from "vitest";
import {
  formatReportDate,
  formatReportDateTime,
  formatPatientDisplayId,
  getReportDateRange,
  getReportFilename,
  getReportPeriodLabel,
} from "./reporting";

describe("report date utilities", () => {
  const today = new Date(2026, 8, 16, 12);

  it("builds local date ranges for the supported presets", () => {
    expect(getReportDateRange("today", today)).toEqual({ from: "2026-09-16", to: "2026-09-16" });
    expect(getReportDateRange("specific", today, "2026-09-02")).toEqual({ from: "2026-09-02", to: "2026-09-02" });
    expect(getReportDateRange("thisWeek", today)).toEqual({ from: "2026-09-14", to: "2026-09-20" });
    expect(getReportDateRange("thisMonth", today)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(getReportDateRange("thisYear", today)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(getReportDateRange("all", today)).toEqual({ from: "", to: "" });
  });

  it("formats dates for people without changing invalid values", () => {
    expect(formatReportDate("2026-09-01")).toBe("1 Sep 2026");
    expect(formatReportDate("not-a-date")).toBe("not-a-date");
    expect(formatReportDate(null)).toBe("—");
  });

  it("formats visit timestamps and hides the PT prefix in report OPD numbers", () => {
    expect(formatReportDateTime("2026-09-01T14:05:00.000Z")).toBe("1 Sep 2026, 2:05 PM");
    expect(formatReportDateTime(null)).toBe("—");
    expect(formatPatientDisplayId("PT-12/2026")).toBe("12/2026");
  });

  it("builds clear period labels and export filenames", () => {
    expect(getReportPeriodLabel({ from: "2026-09-01", to: "2026-09-30" })).toBe("1 Sep 2026 – 30 Sep 2026");
    expect(getReportFilename("patients", { from: "2026-09-01", to: "2026-09-30" }, "pdf"))
      .toBe("patient-registration_2026-09-01_to_2026-09-30.pdf");
  });
});
