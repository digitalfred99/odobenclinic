import { endOfMonth, endOfWeek, endOfYear, format, startOfMonth, startOfWeek, startOfYear, subDays } from "date-fns";

export type VisitDatePreset = "all" | "today" | "yesterday" | "thisWeek" | "thisMonth" | "thisYear" | "custom";
export type VisitDateRange = { dateFrom: string; dateTo: string };

function toLocalDateString(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function getVisitDateRange(preset: Exclude<VisitDatePreset, "all" | "custom">, today = new Date()): VisitDateRange {
  switch (preset) {
    case "today": {
      const date = toLocalDateString(today);
      return { dateFrom: date, dateTo: date };
    }
    case "yesterday": {
      const date = toLocalDateString(subDays(today, 1));
      return { dateFrom: date, dateTo: date };
    }
    case "thisWeek":
      return {
        dateFrom: toLocalDateString(startOfWeek(today, { weekStartsOn: 1 })),
        dateTo: toLocalDateString(endOfWeek(today, { weekStartsOn: 1 })),
      };
    case "thisMonth":
      return { dateFrom: toLocalDateString(startOfMonth(today)), dateTo: toLocalDateString(endOfMonth(today)) };
    case "thisYear":
      return { dateFrom: toLocalDateString(startOfYear(today)), dateTo: toLocalDateString(endOfYear(today)) };
  }
}

export function buildOPDVisitQuery(search: string, range: VisitDateRange, page: number, limit = 20) {
  const params = new URLSearchParams();
  const searchTerm = search.trim();

  if (searchTerm) params.set("search", searchTerm);
  if (range.dateFrom) params.set("dateFrom", range.dateFrom);
  if (range.dateTo) params.set("dateTo", range.dateTo);
  params.set("page", String(page));
  params.set("limit", String(limit));

  return params.toString();
}
