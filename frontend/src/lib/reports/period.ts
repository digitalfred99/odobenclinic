import { format, parseISO } from "date-fns";

export const CLINIC_TIME_ZONE = "Africa/Accra";
/** Start of "All time". No clinic record is older than this. */
export const EPOCH = "2000-01-01";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CLINIC_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}); // yyyy-MM-dd

export const clinicToday = (now: number = Date.now()) => dayFormatter.format(now);

const DAY_MS = 86_400_000;
const toMs = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const addDays = (date: string, days: number) => fromMs(toMs(date) + days * DAY_MS);
export const diffDays = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / DAY_MS);
export const weekdayOf = (date: string) => new Date(toMs(date)).getUTCDay(); // 0 = Sunday
export const mondayIndex = (date: string) => (weekdayOf(date) + 6) % 7; // 0 = Monday
export const minDate = (a: string, b: string) => (a < b ? a : b);
export const maxDate = (a: string, b: string) => (a > b ? a : b);
export const startOfMonth = (date: string) => `${date.slice(0, 8)}01`;

export function endOfMonth(date: string) {
  const [y, m] = date.split("-").map(Number);
  return fromMs(Date.UTC(y, m, 0));
}

export function addMonths(date: string, months: number) {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return fromMs(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, lastDay)));
}

function shiftYear(date: string, years: number) {
  const [y, m, d] = date.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y + years, m, 0)).getUTCDate();
  return fromMs(Date.UTC(y + years, m - 1, Math.min(d, lastDay)));
}

export type PeriodPreset =
  | "today" | "yesterday" | "last7" | "last30"
  | "thisMonth" | "lastMonth" | "thisQuarter" | "thisYear"
  | "all" | "custom";
export type Period = { preset: PeriodPreset; from: string; to: string };
export type CompareMode = "previous" | "lastYear" | "none";

export const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "thisMonth", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "thisQuarter", label: "This quarter" },
  { value: "thisYear", label: "This year" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom range" },
];

export function resolvePreset(preset: PeriodPreset, today: string, custom?: { from: string; to: string }): Period {
  switch (preset) {
    case "today":
      return { preset, from: today, to: today };
    case "yesterday": {
      const y = addDays(today, -1);
      return { preset, from: y, to: y };
    }
    case "last7":
      return { preset, from: addDays(today, -6), to: today };
    case "last30":
      return { preset, from: addDays(today, -29), to: today };
    case "thisMonth":
      return { preset, from: startOfMonth(today), to: today };
    case "lastMonth": {
      const start = addMonths(startOfMonth(today), -1);
      return { preset, from: start, to: endOfMonth(start) };
    }
    case "thisQuarter": {
      const [y, m] = today.split("-").map(Number);
      const startMonth = Math.floor((m - 1) / 3) * 3 + 1;
      return { preset, from: `${y}-${String(startMonth).padStart(2, "0")}-01`, to: today };
    }
    case "thisYear":
      return { preset, from: `${today.slice(0, 4)}-01-01`, to: today };
    case "all":
      return { preset, from: "", to: "" };
    default:
      return { preset: "custom", from: custom?.from ?? "", to: custom?.to ?? "" };
  }
}

const isWholeMonth = (p: Period) => p.from.endsWith("-01") && p.to === endOfMonth(p.from);

export function previousPeriod(p: Period, mode: Exclude<CompareMode, "none">): Period | null {
  if (!p.from || !p.to) return null;
  if (mode === "lastYear") return { preset: "custom", from: shiftYear(p.from, -1), to: shiftYear(p.to, -1) };

  const length = diffDays(p.from, p.to) + 1;
  const monthsBack =
    p.preset === "thisQuarter" ? 3
    : p.preset === "thisYear" ? 12
    : p.preset === "thisMonth" || p.preset === "lastMonth" || isWholeMonth(p) ? 1
    : 0;

  if (monthsBack) {
    // An unfinished month is compared with the same number of days of the month before.
    const from = addMonths(p.from, -monthsBack);
    const cap = endOfMonth(addMonths(from, monthsBack - 1));
    return { preset: "custom", from, to: minDate(addDays(from, length - 1), cap) };
  }
  return { preset: "custom", from: addDays(p.from, -length), to: addDays(p.from, -1) };
}

export function shiftPeriod(p: Period, direction: 1 | -1): Period {
  if (!p.from || !p.to) return p;
  if (p.preset === "thisMonth" || p.preset === "lastMonth" || isWholeMonth(p)) {
    const from = addMonths(startOfMonth(p.from), direction);
    return { preset: "custom", from, to: endOfMonth(from) };
  }
  const length = diffDays(p.from, p.to) + 1;
  return { preset: "custom", from: addDays(p.from, direction * length), to: addDays(p.to, direction * length) };
}

export function periodLabel(p: Period): string {
  const f = (d: string) => format(parseISO(d), "d MMM yyyy");
  if (!p.from && !p.to) return "All time";
  if (p.from && !p.to) return `From ${f(p.from)}`;
  if (!p.from && p.to) return `Up to ${f(p.to)}`;
  return p.from === p.to ? f(p.from) : `${f(p.from)} – ${f(p.to)}`;
}

export type BucketSize = "day" | "week" | "month";
export const bucketSizeFor = (lengthInDays: number): BucketSize =>
  lengthInDays <= 62 ? "day" : lengthInDays <= 400 ? "week" : "month";

export function bucketStart(date: string, size: BucketSize) {
  if (size === "day") return date;
  if (size === "week") return addDays(date, -mondayIndex(date));
  return startOfMonth(date);
}
export function bucketEnd(start: string, size: BucketSize) {
  if (size === "day") return start;
  if (size === "week") return addDays(start, 6);
  return endOfMonth(start);
}
export function nextBucketStart(start: string, size: BucketSize) {
  if (size === "day") return addDays(start, 1);
  if (size === "week") return addDays(start, 7);
  return addMonths(start, 1);
}
export const bucketLabel = (start: string, size: BucketSize) =>
  format(parseISO(start), size === "month" ? "MMM yyyy" : "d MMM");
