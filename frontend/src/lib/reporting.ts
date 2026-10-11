import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";

export type ReportPeriodPreset = "today" | "specific" | "thisWeek" | "thisMonth" | "thisYear" | "custom" | "all";

export type ReportDateRange = {
  from: string;
  to: string;
};

export function formatReportDate(value: string | null | undefined): string {
  if (!value) return "—";
  const dateValue = value.slice(0, 10);
  const parsedDate = parseISO(dateValue);
  return isValid(parsedDate) && format(parsedDate, "yyyy-MM-dd") === dateValue
    ? format(parsedDate, "d MMM yyyy")
    : value;
}

export function formatReportDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? value : format(parsedDate, "d MMM yyyy, h:mm a");
}

export function formatPatientDisplayId(value: string): string {
  return value.replace(/^PT-/i, "");
}

export function getReportDateRange(
  preset: ReportPeriodPreset,
  today = new Date(),
  selectedDate = "",
  customRange: ReportDateRange = { from: "", to: "" }
): ReportDateRange {
  const toInputDate = (date: Date) => format(date, "yyyy-MM-dd");

  switch (preset) {
    case "today": {
      const date = toInputDate(today);
      return { from: date, to: date };
    }
    case "specific": {
      const date = selectedDate || toInputDate(today);
      return { from: date, to: date };
    }
    case "thisWeek":
      return {
        from: toInputDate(startOfWeek(today, { weekStartsOn: 1 })),
        to: toInputDate(endOfWeek(today, { weekStartsOn: 1 })),
      };
    case "thisMonth":
      return { from: toInputDate(startOfMonth(today)), to: toInputDate(endOfMonth(today)) };
    case "thisYear":
      return { from: toInputDate(startOfYear(today)), to: toInputDate(endOfYear(today)) };
    case "custom":
      return customRange;
    case "all":
      return { from: "", to: "" };
  }
}

export function getReportPeriodLabel(range: ReportDateRange): string {
  if (!range.from && !range.to) return "All dates";
  if (range.from && range.to) {
    if (range.from === range.to) return formatReportDate(range.from);
    return `${formatReportDate(range.from)} – ${formatReportDate(range.to)}`;
  }
  return range.from ? `From ${formatReportDate(range.from)}` : `Through ${formatReportDate(range.to)}`;
}

export function getReportFilename(
  reportType: "patients" | "opd-visits",
  range: ReportDateRange,
  extension: "xlsx" | "csv" | "pdf"
): string {
  const reportName = reportType === "patients" ? "patient-registration" : "opd-visits";
  const periodName = range.from && range.to
    ? `${range.from}_to_${range.to}`
    : range.from
      ? `from_${range.from}`
      : range.to
        ? `through_${range.to}`
        : "all-dates";
  return `${reportName}_${periodName}.${extension}`;
}
