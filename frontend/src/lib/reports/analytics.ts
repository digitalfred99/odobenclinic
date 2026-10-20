import {
  addDays, bucketEnd, bucketLabel, bucketStart, diffDays, mondayIndex, nextBucketStart,
  type BucketSize, type PeriodPreset,
} from "./period";
import type { MaritalStatus, MissingKey, PatientRecord, Place, Sex, Slice, VisitRecord } from "./types";

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Bands follow the Ghana Health Service OPD return. Check them against your current form. */
export const AGE_BANDS = [
  { label: "Under 1", min: 0, max: 0 }, { label: "1–4", min: 1, max: 4 }, { label: "5–9", min: 5, max: 9 },
  { label: "10–14", min: 10, max: 14 }, { label: "15–17", min: 15, max: 17 }, { label: "18–19", min: 18, max: 19 },
  { label: "20–34", min: 20, max: 34 }, { label: "35–49", min: 35, max: 49 }, { label: "50–59", min: 50, max: 59 },
  { label: "60–69", min: 60, max: 69 }, { label: "70+", min: 70, max: 200 },
];

export const MISSING_LABELS: Record<MissingKey, string> = {
  phone: "Missing phone number",
  dob: "Missing date of birth",
  ghCard: "Missing Ghana Card",
  nhis: "Missing NHIS number",
  area: "Missing area",
  duplicate: "Possible duplicates",
};

export const ageBandOf = (age: number | null) =>
  age === null ? "Unknown" : AGE_BANDS.find((band) => age >= band.min && age <= band.max)?.label ?? "Unknown";
export const placeLabel = (value: string) => value || "Not recorded";
const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/* ---------- slicing ---------- */

type Demo = Place & { date: string; sex: Sex; age: number | null; maritalStatus?: MaritalStatus };

function matchesDemo(r: Demo, s: Slice) {
  if (s.sex && r.sex !== s.sex) return false;
  if (s.maritalStatus && (r.maritalStatus ?? "unknown") !== s.maritalStatus) return false;
  if (s.ageBand && ageBandOf(r.age) !== s.ageBand) return false;
  if (s.area && placeLabel(r.area) !== s.area) return false;
  if (s.town && placeLabel(r.town) !== s.town) return false;
  if (s.district && placeLabel(r.district) !== s.district) return false;
  if (s.region && placeLabel(r.region) !== s.region) return false;
  if (s.weekday !== null && mondayIndex(r.date) !== s.weekday) return false;
  return true;
}

export const matchesVisit = (v: VisitRecord, s: Slice) => matchesDemo(v, s) && (!s.type || v.type === s.type);

export function matchesPatient(p: PatientRecord, s: Slice, duplicates: Set<string>) {
  if (!matchesDemo(p, s)) return false;
  switch (s.missing) {
    case "phone": return !p.hasPhone;
    case "dob": return !p.hasDob;
    case "ghCard": return !p.hasGhCard;
    case "nhis": return !p.hasNhis;
    case "area": return !p.area;
    case "duplicate": return duplicates.has(p.pid);
    default: return true;
  }
}

export function describeSlice(s: Slice): { key: keyof Slice; label: string }[] {
  const out: { key: keyof Slice; label: string }[] = [];
  if (s.sex) out.push({ key: "sex", label: s.sex === "other" ? "Other or unknown sex" : cap(s.sex) });
  if (s.maritalStatus) out.push({ key: "maritalStatus", label: `Marital status: ${s.maritalStatus === "unknown" ? "Not recorded" : cap(s.maritalStatus)}` });
  if (s.ageBand) out.push({ key: "ageBand", label: `Age ${s.ageBand}` });
  if (s.type) out.push({ key: "type", label: `${cap(s.type)} visits` });
  if (s.area) out.push({ key: "area", label: `Area: ${s.area}` });
  if (s.town) out.push({ key: "town", label: `Town: ${s.town}` });
  if (s.district) out.push({ key: "district", label: `District: ${s.district}` });
  if (s.region) out.push({ key: "region", label: `Region: ${s.region}` });
  if (s.weekday !== null) out.push({ key: "weekday", label: WEEKDAYS[s.weekday] });
  if (s.missing) out.push({ key: "missing", label: MISSING_LABELS[s.missing] });
  return out;
}

/* ---------- summary and comparison ---------- */

export type Summary = {
  visits: number; unique: number; newVisits: number; returning: number;
  registrations: number; days: number; perDay: number;
};

export function summarize(visits: VisitRecord[], registrations: number, days: number): Summary {
  const pids = new Set<string>();
  let newVisits = 0;
  let returning = 0;
  visits.forEach((v) => {
    pids.add(v.pid);
    if (v.type === "new") newVisits++;
    else if (v.type === "returning") returning++;
  });
  const safeDays = Math.max(1, days);
  return { visits: visits.length, unique: pids.size, newVisits, returning, registrations, days: safeDays, perDay: visits.length / safeDays };
}

export function describeDelta(current: number, previous: number, label: string) {
  const diff = current - previous;
  if (diff === 0) return `Same as ${label} (${previous.toLocaleString()})`;
  const base = `${Math.abs(diff).toLocaleString()} ${diff > 0 ? "more" : "fewer"} than ${label}`;
  if (previous === 0) return base;
  return `${base} (${Math.round((Math.abs(diff) / previous) * 100)}% ${diff > 0 ? "higher" : "lower"})`;
}

/* ---------- trend ---------- */

export type Bucket = { start: string; end: string; label: string; total: number; newVisits: number; returning: number };

export function buildTrend(visits: VisitRecord[], from: string, to: string, size: BucketSize): Bucket[] {
  const list: Bucket[] = [];
  const index = new Map<string, Bucket>();
  let cursor = bucketStart(from, size);
  const last = bucketStart(to, size);
  while (cursor <= last && list.length < 800) {
    const bucket = { start: cursor, end: bucketEnd(cursor, size), label: bucketLabel(cursor, size), total: 0, newVisits: 0, returning: 0 };
    list.push(bucket);
    index.set(cursor, bucket);
    cursor = nextBucketStart(cursor, size);
  }
  visits.forEach((v) => {
    const bucket = index.get(bucketStart(v.date, size));
    if (!bucket) return;
    bucket.total++;
    if (v.type === "new") bucket.newVisits++;
    else if (v.type === "returning") bucket.returning++;
  });
  return list;
}

/* ---------- demographics and places ---------- */

export type PyramidRow = { band: string; male: number; female: number; other: number };

export function buildPyramid(rows: { age: number | null; sex: Sex }[]): PyramidRow[] {
  const map = new Map<string, PyramidRow>(AGE_BANDS.map((b) => [b.label, { band: b.label, male: 0, female: 0, other: 0 }]));
  map.set("Unknown", { band: "Unknown", male: 0, female: 0, other: 0 });
  rows.forEach((r) => {
    const row = map.get(ageBandOf(r.age));
    if (!row) return;
    if (r.sex === "male") row.male += 1;
    else if (r.sex === "female") row.female += 1;
    else row.other += 1;
  });
  return [...map.values()].filter((r) => r.band !== "Unknown" || r.male + r.female + r.other > 0);
}

export type Ranked = { name: string; count: number; share: number };

export function buildMaritalBreakdown(rows: PatientRecord[]) {
  const labels: Record<MaritalStatus, string> = {
    single: "Single", married: "Married", divorced: "Divorced", widowed: "Widowed", unknown: "Not recorded",
  };
  const counts = new Map<MaritalStatus, number>();
  rows.forEach((row) => {
    const status = row.maritalStatus ?? "unknown";
    counts.set(status, (counts.get(status) ?? 0) + 1);
  });
  return [...counts.entries()]
    .map(([status, count]) => ({ status, name: labels[status], count, share: count / (rows.length || 1) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function rankBy<T>(rows: T[], pick: (row: T) => string, limit = 10): Ranked[] {
  const counts = new Map<string, number>();
  rows.forEach((r) => counts.set(placeLabel(pick(r)), (counts.get(placeLabel(pick(r))) ?? 0) + 1));
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = rows.length || 1;
  const top = sorted.slice(0, limit).map(([name, count]) => ({ name, count, share: count / total }));
  const rest = sorted.slice(limit).reduce((sum, [, count]) => sum + count, 0);
  return rest > 0 ? [...top, { name: "Other places", count: rest, share: rest / total }] : top;
}

/** Places that sent at least 3 visits before and none now. */
export function findQuietPlaces(previous: VisitRecord[], current: VisitRecord[], pick: (v: VisitRecord) => string) {
  const now = new Set(current.map((v) => placeLabel(pick(v))));
  const before = new Map<string, number>();
  previous.forEach((v) => before.set(placeLabel(pick(v)), (before.get(placeLabel(pick(v))) ?? 0) + 1));
  return [...before.entries()]
    .filter(([name, count]) => count >= 3 && !now.has(name) && name !== "Not recorded")
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, previous: count }));
}

/* ---------- busy hours ---------- */

export function hourOf(at: string | null): number | null {
  if (!at) return null;
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(at)) {
    const d = new Date(at);
    return Number.isNaN(d.getTime()) ? null : d.getUTCHours(); // Ghana is UTC+0 all year
  }
  if (at.length < 13) return null;
  const h = Number(at.slice(11, 13));
  return Number.isFinite(h) ? h : null;
}

export type Heatmap = { grid: number[][]; max: number; withHour: number; total: number; minHour: number; maxHour: number };

export function buildHeatmap(visits: VisitRecord[]): Heatmap {
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  let withHour = 0;
  let max = 0;
  let minHour = 24;
  let maxHour = -1;
  visits.forEach((v) => {
    const h = hourOf(v.at);
    if (h === null) return;
    withHour++;
    const day = mondayIndex(v.date);
    grid[day][h]++;
    max = Math.max(max, grid[day][h]);
    minHour = Math.min(minHour, h);
    maxHour = Math.max(maxHour, h);
  });
  if (maxHour < 0) { minHour = 8; maxHour = 17; }
  return { grid, max, withHour, total: visits.length, minHour, maxHour };
}

const median = (values: number[]) => {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export function dailyCounts(visits: VisitRecord[]) {
  const counts = new Map<string, number>();
  visits.forEach((v) => counts.set(v.date, (counts.get(v.date) ?? 0) + 1));
  return counts;
}

/** `to` should be yesterday or earlier, so today's unfinished count does not pull the norm down. */
export function weekdayStats(counts: Map<string, number>, from: string, to: string) {
  const totals = Array<number>(7).fill(0);
  const samples: number[][] = Array.from({ length: 7 }, () => []);
  for (let d = from, n = 0; d <= to && n < 4000; d = addDays(d, 1), n++) {
    const c = counts.get(d) ?? 0;
    const i = mondayIndex(d);
    totals[i] += c;
    samples[i].push(c);
  }
  return { totals, typical: samples.map(median), sampleSize: samples.map((s) => s.length) };
}

export type UnusualDay = { date: string; count: number; typical: number; kind: "quiet" | "busy" };

export function findUnusualDays(counts: Map<string, number>, from: string, to: string, typical: number[], sampleSize: number[]): UnusualDay[] {
  const out: UnusualDay[] = [];
  for (let d = from, n = 0; d <= to && n < 4000; d = addDays(d, 1), n++) {
    const i = mondayIndex(d);
    const norm = typical[i];
    if (sampleSize[i] < 4 || norm < 5) continue;
    const count = counts.get(d) ?? 0;
    if (count <= norm * 0.2) out.push({ date: d, count, typical: norm, kind: "quiet" });
    else if (count >= norm * 1.8 && count - norm >= 10) out.push({ date: d, count, typical: norm, kind: "busy" });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
}

/* ---------- returning patients ---------- */

export function visitFrequency(visits: VisitRecord[]) {
  const per = new Map<string, number>();
  visits.forEach((v) => per.set(v.pid, (per.get(v.pid) ?? 0) + 1));
  const buckets = [{ label: "1 visit", patients: 0 }, { label: "2–3 visits", patients: 0 }, { label: "4 or more", patients: 0 }];
  per.forEach((n) => { buckets[n === 1 ? 0 : n <= 3 ? 1 : 2].patients++; });
  return buckets;
}

export const RETENTION_WINDOWS = [30, 90, 180];

export function buildRetention(visits: VisitRecord[], today: string, months = 12) {
  const byPid = new Map<string, string[]>();
  visits.forEach((v) => { const l = byPid.get(v.pid); if (l) l.push(v.date); else byPid.set(v.pid, [v.date]); });
  const cohorts = new Map<string, { size: number; cells: { eligible: number; returned: number }[] }>();
  byPid.forEach((dates) => {
    dates.sort();
    const first = dates[0];
    const key = first.slice(0, 7);
    let cohort = cohorts.get(key);
    if (!cohort) { cohort = { size: 0, cells: RETENTION_WINDOWS.map(() => ({ eligible: 0, returned: 0 })) }; cohorts.set(key, cohort); }
    cohort.size++;
    RETENTION_WINDOWS.forEach((days, i) => {
      const limit = addDays(first, days);
      if (limit > today) return;
      cohort!.cells[i].eligible++;
      if (dates.some((d) => d > first && d <= limit)) cohort!.cells[i].returned++;
    });
  });
  return [...cohorts.entries()].sort(([a], [b]) => b.localeCompare(a)).slice(0, months).map(([month, c]) => ({ month, ...c }));
}

export type LapsedPatient = { pid: string; visits: number; lastDate: string; daysSince: number; age: number | null; sex: Sex; area: string };

export function findLapsed(visits: VisitRecord[], today: string, days = 90): LapsedPatient[] {
  const by = new Map<string, { count: number; last: VisitRecord }>();
  visits.forEach((v) => {
    const cur = by.get(v.pid);
    if (!cur) by.set(v.pid, { count: 1, last: v });
    else { cur.count++; if (v.date > cur.last.date) cur.last = v; }
  });
  return [...by.values()]
    .filter((x) => x.count >= 2 && addDays(x.last.date, days) <= today)
    .map((x) => ({ pid: x.last.pid, visits: x.count, lastDate: x.last.date, daysSince: diffDays(x.last.date, today), age: x.last.age, sex: x.last.sex, area: x.last.area }))
    .sort((a, b) => a.daysSince - b.daysSince);
}

/* ---------- data quality ---------- */

export function findDuplicates(patients: PatientRecord[]) {
  const matches: { reason: string; pids: Set<string> }[] = [];
  const scan = (pick: (p: PatientRecord) => string | null, reason: string) => {
    const map = new Map<string, Set<string>>();
    patients.forEach((p) => {
      const key = pick(p);
      if (!key) return;
      const set = map.get(key);
      if (set) set.add(p.pid); else map.set(key, new Set([p.pid]));
    });
    map.forEach((set) => { if (set.size > 1) matches.push({ reason, pids: set }); });
  };
  scan((p) => p.nameKey, "Same name and date of birth");
  scan((p) => p.phoneKey, "Same phone number");
  const groups: { reasons: string[]; pids: string[] }[] = [];
  const groupByPatient = new Map<string, { reasons: Set<string>; pids: Set<string> }>();
  matches.forEach(({ reason, pids }) => {
    const overlapping = [...pids].map((pid) => groupByPatient.get(pid)).filter((group): group is NonNullable<typeof group> => Boolean(group));
    const group = overlapping[0] ?? { reasons: new Set<string>(), pids: new Set<string>() };
    overlapping.slice(1).forEach((other) => {
      other.pids.forEach((pid) => { group.pids.add(pid); groupByPatient.set(pid, group); });
      other.reasons.forEach((item) => group.reasons.add(item));
    });
    group.reasons.add(reason);
    pids.forEach((pid) => { group.pids.add(pid); groupByPatient.set(pid, group); });
  });
  new Set(groupByPatient.values()).forEach((group) => groups.push({
    reasons: [...group.reasons],
    pids: [...group.pids].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
  }));
  groups.sort((a, b) => b.pids.length - a.pids.length);
  return { groups, pids: new Set(groupByPatient.keys()) };
}

export function buildQuality(patients: PatientRecord[]) {
  const total = patients.length;
  const count = (test: (p: PatientRecord) => boolean) => patients.filter(test).length;
  const defs: { key: MissingKey; label: string; missing: number }[] = [
    { key: "phone", label: "Phone number", missing: count((p) => !p.hasPhone) },
    { key: "dob", label: "Date of birth", missing: count((p) => !p.hasDob) },
    { key: "ghCard", label: "Ghana Card", missing: count((p) => !p.hasGhCard) },
    { key: "nhis", label: "NHIS number", missing: count((p) => !p.hasNhis) },
    { key: "area", label: "Area", missing: count((p) => !p.area) },
  ];
  return { total, fields: defs.map((f) => ({ ...f, pct: total ? Math.round((f.missing / total) * 100) : 0 })) };
}
export type Quality = ReturnType<typeof buildQuality>;

/* ---------- plain-sentence insights (fixed rules, no AI) ---------- */

export function buildInsights(i: {
  summary: Summary; prev: Summary | null; prevLabel: string;
  weekdayTotals: number[]; heat: Heatmap; pyramid: PyramidRow[]; areas: Ranked[];
}): string[] {
  const { summary, prev } = i;
  if (summary.visits === 0) return ["No visits match the current period and filters."];
  const out: string[] = [];

  if (prev && prev.visits > 0) {
    const diff = summary.visits - prev.visits;
    const pct = Math.round((Math.abs(diff) / prev.visits) * 100);
    out.push(diff === 0
      ? `Visits are the same as ${i.prevLabel} (${prev.visits.toLocaleString()}).`
      : `Visits are ${pct}% ${diff > 0 ? "higher" : "lower"} than ${i.prevLabel}: ${summary.visits.toLocaleString()} against ${prev.visits.toLocaleString()}.`);
  }

  const weekTotal = i.weekdayTotals.reduce((a, b) => a + b, 0);
  if (weekTotal >= 10) {
    const top = i.weekdayTotals.indexOf(Math.max(...i.weekdayTotals));
    out.push(`Busiest weekday: ${WEEKDAYS[top]}, with ${i.weekdayTotals[top].toLocaleString()} visits (${Math.round((i.weekdayTotals[top] / weekTotal) * 100)}% of the total).`);
  }

  if (i.heat.total >= 10 && i.heat.withHour >= i.heat.total * 0.5 && i.heat.max > 0) {
    let day = 0; let hour = 0;
    i.heat.grid.forEach((row, d) => row.forEach((n, h) => { if (n > i.heat.grid[day][hour]) { day = d; hour = h; } }));
    out.push(`Busiest time: ${WEEKDAYS[day]} ${hour}:00 to ${hour + 1}:00, with ${i.heat.grid[day][hour]} visits in the period.`);
  }

  let best = { label: "", count: 0 };
  i.pyramid.forEach((r) => {
    if (r.male > best.count) best = { label: `men aged ${r.band}`, count: r.male };
    if (r.female > best.count) best = { label: `women aged ${r.band}`, count: r.female };
  });
  if (best.count > 0) out.push(`Largest group: ${best.label}, ${Math.round((best.count / summary.visits) * 100)}% of visits.`);

  if (summary.newVisits + summary.returning > 0) {
    out.push(`New patients make up ${Math.round((summary.newVisits / (summary.newVisits + summary.returning)) * 100)}% of visits.`);
  }
  const area = i.areas.find((a) => a.name !== "Not recorded" && a.name !== "Other places");
  if (area) out.push(`Top area: ${area.name}, ${area.count.toLocaleString()} visits (${Math.round(area.share * 100)}%).`);
  return out.slice(0, 6);
}

/* ---------- the "type to filter" bar ---------- */

export type ParsedCommand = { preset: PeriodPreset | null; slice: Partial<Slice>; summary: string[]; leftover: string };

const PERIOD_WORDS: [RegExp, PeriodPreset, string][] = [
  [/\b(last|past) (7 days|week)\b|\bthis week\b/, "last7", "Last 7 days"],
  [/\b(last|past) 30 days\b/, "last30", "Last 30 days"],
  [/\blast month\b/, "lastMonth", "Last month"],
  [/\bthis month\b/, "thisMonth", "This month"],
  [/\bthis quarter\b/, "thisQuarter", "This quarter"],
  [/\bthis year\b/, "thisYear", "This year"],
  [/\byesterday\b/, "yesterday", "Yesterday"],
  [/\btoday\b/, "today", "Today"],
  [/\ball time\b/, "all", "All time"],
];
const STOP = new Set(["show", "me", "visits", "visit", "patients", "patient", "of", "in", "from", "for", "the", "only", "and", "at", "to"]);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function parseCommand(input: string, vocab: { areas: string[]; towns: string[]; districts: string[]; regions: string[] }): ParsedCommand {
  let text = ` ${input.toLowerCase().trim()} `;
  const slice: Partial<Slice> = {};
  const summary: string[] = [];
  let preset: PeriodPreset | null = null;
  const take = (re: RegExp) => { const hit = re.test(text); if (hit) text = text.replace(re, " "); return hit; };

  for (const [re, value, label] of PERIOD_WORDS) if (!preset && take(re)) { preset = value; summary.push(label); }
  if (take(/\b(female|females|women|woman|girls?)\b/)) { slice.sex = "female"; summary.push("Female"); }
  else if (take(/\b(male|males|men|man|boys?)\b/)) { slice.sex = "male"; summary.push("Male"); }
  const maritalStatus = text.match(/\b(single|married|divorced|widowed)\b/);
  if (maritalStatus) {
    slice.maritalStatus = maritalStatus[1] as Exclude<MaritalStatus, "unknown">;
    summary.push(`Marital status: ${cap(maritalStatus[1])}`);
    text = text.replace(maritalStatus[0], " ");
  }
  if (take(/\bnew\b/)) { slice.type = "new"; summary.push("New visits"); }
  else if (take(/\b(returning|repeat)\b/)) { slice.type = "returning"; summary.push("Returning visits"); }

  const ageMatch = text.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})/);
  if (ageMatch) {
    const band = AGE_BANDS.find((b) => b.label === `${ageMatch[1]}–${ageMatch[2]}`);
    if (band) { slice.ageBand = band.label; summary.push(`Age ${band.label}`); text = text.replace(ageMatch[0], " "); }
  } else if (take(/\b(infants?|under 1)\b/)) { slice.ageBand = "Under 1"; summary.push("Age Under 1"); }
  else if (take(/\b(elderly|70\+)\b/)) { slice.ageBand = "70+"; summary.push("Age 70+"); }

  WEEKDAYS.forEach((name, i) => { if (take(new RegExp(`\\b${name.toLowerCase()}s?\\b`))) { slice.weekday = i; summary.push(name); } });

  const places: ["area" | "town" | "district" | "region", string[], string][] = [
    ["area", vocab.areas, "Area"], ["town", vocab.towns, "Town"], ["district", vocab.districts, "District"], ["region", vocab.regions, "Region"],
  ];
  for (const [key, names, label] of places) {
    const found = [...names].sort((a, b) => b.length - a.length).find((n) => n !== "Not recorded" && new RegExp(`(^|\\s)${escape(n.toLowerCase())}(\\s|$)`).test(text));
    if (found) { slice[key] = found; summary.push(`${label}: ${found}`); text = text.replace(found.toLowerCase(), " "); }
  }

  const leftover = text.split(/\s+/).filter((w) => w && !STOP.has(w)).join(" ");
  return { preset, slice, summary, leftover };
}
