import { ApiError, apiRequest } from "@/lib/api";
import type { OPDVisit, OPDVisitListResponse } from "@/types/opd";
import type { ReportListResponse, ReportRow } from "@/types/report";
import { formatPatientName } from "@/lib/patient-name";
import { readDays, storeClosedRange } from "./cache";
import { EPOCH, addDays, maxDate, minDate, type Period } from "./period";
import type { Dataset, LoadProgress, MaritalStatus, PatientRecord, RecordKind, Sex, Slice, VisitRecord, VisitType } from "./types";

const PAGE_SIZE = 100;
const BATCH = 4;
/** Today and yesterday can still change, so they are always fetched fresh. Older days are cached. */
const OPEN_DAYS = 2;

type Progress = (done: number, total: number) => void;
type ReportFilters = Pick<Slice, "maritalStatus" | "religion">;

function canUseCachedRows(error: unknown) {
  return error instanceof TypeError
    || (error instanceof ApiError && (error.status === 408 || error.status === 429 || error.status >= 500));
}

function reportParams(from: string, to: string, filters: ReportFilters) {
  const params = new URLSearchParams({ from, to });
  if (filters.maritalStatus) params.set("maritalStatus", filters.maritalStatus);
  if (filters.religion) params.set("religion", filters.religion);
  return params;
}

function hasReportFilters(filters: ReportFilters) {
  return Boolean(filters.maritalStatus || filters.religion);
}

export const endpointFor = (kind: RecordKind) => (kind === "visits" ? "/reports/opd-visits" : "/reports/patients");

/* ---------- raw fetching (same paging approach as before) ---------- */

export async function fetchReportRows(
  endpoint: string,
  params: URLSearchParams,
  signal?: AbortSignal,
  onProgress?: Progress
): Promise<ReportRow[]> {
  const first = new URLSearchParams(params);
  first.set("page", "1");
  first.set("limit", String(PAGE_SIZE));
  const firstPage = await apiRequest<ReportListResponse>(`${endpoint}?${first}`, { signal });
  const rows = [...firstPage.rows];
  const totalPages = firstPage.pagination.totalPages;
  onProgress?.(1, totalPages);

  let loaded = 1;
  for (let start = 2; start <= totalPages; start += BATCH) {
    const pages = Array.from({ length: Math.min(BATCH, totalPages - start + 1) }, (_, i) => start + i);
    const batch = await Promise.all(
      pages.map((page) => {
        const p = new URLSearchParams(first);
        p.set("page", String(page));
        return apiRequest<ReportListResponse>(`${endpoint}?${p}`, { signal });
      })
    );
    batch.forEach((response) => rows.push(...response.rows));
    loaded += pages.length;
    onProgress?.(loaded, totalPages);
  }
  return rows;
}

export async function fetchOpdVisitsRange(from: string, to: string, signal?: AbortSignal, onProgress?: Progress): Promise<OPDVisit[]> {
  const params = new URLSearchParams({ page: "1", limit: String(PAGE_SIZE), dateFrom: from, dateTo: to });
  const firstPage = await apiRequest<OPDVisitListResponse>(`/opd-visits?${params}`, { signal });
  const totalPages = firstPage.pagination?.totalPages;
  if (totalPages === undefined) throw new Error("The OPD visit response is missing pagination details.");
  const visits = [...firstPage.opdVisits];
  onProgress?.(1, totalPages);

  let loaded = 1;
  for (let start = 2; start <= totalPages; start += BATCH) {
    const pages = Array.from({ length: Math.min(BATCH, totalPages - start + 1) }, (_, i) => start + i);
    const batch = await Promise.all(
      pages.map((page) => {
        const p = new URLSearchParams(params);
        p.set("page", String(page));
        return apiRequest<OPDVisitListResponse>(`/opd-visits?${p}`, { signal });
      })
    );
    batch.forEach((response) => visits.push(...response.opdVisits));
    loaded += pages.length;
    onProgress?.(loaded, totalPages);
  }
  return visits;
}

export async function fetchOpdVisitDayDetails(date: string, signal?: AbortSignal): Promise<OPDVisit[]> {
  return fetchOpdVisitsRange(date, date, signal);
}

/* ---------- turning full rows into the small records we analyse and cache ---------- */

const text = (value: unknown) => (value == null ? "" : String(value).trim());
const titleCase = (value: string) =>
  value.toLowerCase().replace(/(^|[\s\-'/])(\S)/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
/** "odoben " and "Odoben" become the same place. */
const place = (value: unknown) => titleCase(text(value).replace(/\s+/g, " "));

function toSex(value: unknown): Sex {
  const s = text(value).toLowerCase();
  return s === "male" || s === "m" ? "male" : s === "female" || s === "f" ? "female" : "other";
}
function toAge(value: unknown): number | null {
  const n = typeof value === "number" ? value : parseFloat(text(value));
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}
function toType(value: unknown): VisitType {
  const s = text(value).toLowerCase();
  return s === "new" ? "new" : s === "returning" ? "returning" : "unknown";
}
function toMaritalStatus(value: unknown): MaritalStatus {
  const status = text(value).toLowerCase();
  return status === "single" || status === "married" || status === "divorced" || status === "widowed" ? status : "unknown";
}

/** cyrb53: a quick 53-bit hash. One-way, so saved keys do not reveal names or numbers. */
function hash(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const placeOf = (row: ReportRow | OPDVisit["patient"]) => ({
  area: place(row.area),
  town: place(row.town),
  district: place(row.district),
  region: place(row.region),
});

export function normalizeVisit(row: ReportRow, at: string | null): VisitRecord | null {
  const date = text(row.date).slice(0, 10);
  if (date.length < 10) return null;
  return {
    pid: text(row.patientId),
    date,
    type: toType(row.newReturning),
    age: toAge(row.age),
    sex: toSex(row.gender),
    maritalStatus: toMaritalStatus(row.maritalStatus),
    at,
    ...placeOf(row),
  };
}

export function normalizePatient(row: ReportRow): PatientRecord | null {
  const date = text(row.dateRegistered ?? row.date).slice(0, 10);
  if (date.length < 10) return null;
  const name = formatPatientName(row) || text(row.name);
  const nameToken = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const dob = text(row.dateOfBirth).slice(0, 10);
  const phoneDigits = text(row.phone).replace(/\D/g, "");
  return {
    pid: text(row.patientId),
    date,
    age: toAge(row.age),
    sex: toSex(row.gender),
    maritalStatus: toMaritalStatus(row.maritalStatus),
    hasPhone: phoneDigits.length >= 7,
    hasDob: dob !== "",
    hasGhCard: text(row.ghCardNumber) !== "",
    hasNhis: text(row.nhisNumber) !== "",
    nameKey: nameToken && dob ? hash(`${nameToken}|${dob}`) : null,
    phoneKey: phoneDigits.length >= 7 ? hash(phoneDigits.slice(-9)) : null,
    ...placeOf(row),
  };
}

/* ---------- loading with the cache ---------- */

type RangeResult<T> = { rows: T[]; cacheable: boolean; warnings: string[] };
type RangeFetcher<T> = (from: string, to: string) => Promise<RangeResult<T>>;

function bucketByDate<T extends { date: string }>(rows: T[]) {
  const map = new Map<string, T[]>();
  rows.forEach((row) => {
    const list = map.get(row.date);
    if (list) list.push(row);
    else map.set(row.date, [row]);
  });
  return map;
}

async function loadDataset<T extends { date: string }>(
  kind: RecordKind,
  period: Period,
  today: string,
  signal: AbortSignal,
  refresh: boolean,
  fetchRange: RangeFetcher<T>
): Promise<Dataset<T>> {
  const from = period.from || EPOCH;
  const to = period.to || today;
  const closedLimit = addDays(today, -OPEN_DAYS);
  const closedTo = minDate(to, closedLimit);
  const rows: T[] = [];
  const warnings: string[] = [];
  let usedCache = false;

  if (from <= closedTo) {
    const cachedRows = refresh ? [] : await readDays<T>(kind, from, closedTo);
    try {
      const result = await fetchRange(from, closedTo);
      warnings.push(...result.warnings);
      rows.push(...result.rows);
      if (result.cacheable) {
        await storeClosedRange(kind, from, closedTo, bucketByDate(result.rows));
      }
    } catch (error) {
      if (signal.aborted || refresh || cachedRows.length === 0 || !canUseCachedRows(error)) throw error;
      rows.push(...cachedRows);
      usedCache = true;
      warnings.push("The server could not be reached, so saved report data is shown and may be out of date.");
    }
  }

  const openFrom = maxDate(from, addDays(closedLimit, 1));
  if (openFrom <= to) {
    const result = await fetchRange(openFrom, to);
    warnings.push(...result.warnings);
    rows.push(...result.rows);
  }
  return { rows, warnings: [...new Set(warnings)], usedCache };
}

const visitKey = (pid: string, date: string, type: string) => `${pid}\u0000${date.slice(0, 10)}\u0000${type}`;

export function loadVisits(
  period: Period,
  today: string,
  signal: AbortSignal,
  onProgress: (progress: LoadProgress) => void,
  refresh = false,
  filters: ReportFilters = { maritalStatus: "", religion: "" }
) {
  const fetchRange: RangeFetcher<VisitRecord> = async (from, to) => {
    const params = reportParams(from, to, filters);
    const reportRows = await fetchReportRows("/reports/opd-visits", params, signal, (done, total) =>
      onProgress({ label: "Loading visits", done, total })
    );

    const times = new Map<string, string[]>();
    const places = new Map<string, OPDVisit["patient"][]>();
    const warnings: string[] = [];
    let cacheable = true;
    try {
      const visits = await fetchOpdVisitsRange(from, to, signal, (done, total) =>
        onProgress({ label: "Loading visit times", done, total })
      );
      visits.forEach((visit) => {
        const pid = visit.patient?.patientId;
        if (!pid || !visit.newReturning) return;
        const key = visitKey(pid, visit.date, visit.newReturning);
        const list = times.get(key);
        if (list) list.push(visit.createdAt ?? "");
        else times.set(key, [visit.createdAt ?? ""]);
        const patientPlaces = places.get(key);
        if (patientPlaces) patientPlaces.push(visit.patient);
        else places.set(key, [visit.patient]);
      });
    } catch (error) {
      if (signal.aborted) throw error;
      // Do not save these days: they would lack visit times for good.
      cacheable = false;
      warnings.push("Visit details could not be loaded, so town and visit-time analysis may be incomplete.");
    }

    const rows = reportRows.flatMap((row) => {
      const key = visitKey(text(row.patientId), text(row.date), text(row.newReturning));
      const at = times.get(key)?.shift() || null;
      const patient = places.get(key)?.shift();
      const record = normalizeVisit(patient ? {
        ...row,
        region: patient.region ?? row.region,
        district: patient.district ?? row.district,
        town: patient.town ?? row.town,
        area: patient.area ?? row.area,
        maritalStatus: patient.maritalStatus ?? row.maritalStatus,
      } : row, at);
      return record ? [record] : [];
    });
    return { rows, cacheable, warnings };
  };
  if (hasReportFilters(filters)) {
    const from = period.from || EPOCH;
    const to = minDate(period.to || today, today);
    if (from > to) return Promise.resolve({ rows: [], warnings: [], usedCache: false });
    return fetchRange(from, to).then(({ rows, warnings }) => ({ rows, warnings, usedCache: false }));
  }
  return loadDataset<VisitRecord>("visits", period, today, signal, refresh, fetchRange);
}

export function loadPatients(
  period: Period,
  today: string,
  signal: AbortSignal,
  onProgress: (progress: LoadProgress) => void,
  refresh = false,
  filters: ReportFilters = { maritalStatus: "", religion: "" }
) {
  const fetchRange: RangeFetcher<PatientRecord> = async (from, to) => {
    const reportRows = await fetchReportRows("/reports/patients", reportParams(from, to, filters), signal, (done, total) =>
      onProgress({ label: "Loading registrations", done, total })
    );
    const rows = reportRows.flatMap((row) => {
      const record = normalizePatient(row);
      return record ? [record] : [];
    });
    return { rows, cacheable: true, warnings: [] };
  };
  if (hasReportFilters(filters)) {
    const from = period.from || EPOCH;
    const to = minDate(period.to || today, today);
    if (from > to) return Promise.resolve({ rows: [], warnings: [], usedCache: false });
    return fetchRange(from, to).then(({ rows, warnings }) => ({ rows, warnings, usedCache: false }));
  }
  return loadDataset<PatientRecord>("patients", period, today, signal, refresh, fetchRange);
}

/* ---------- full rows, only when a table page or an export needs names and phones ---------- */

const detailsCache = new Map<string, ReportRow[]>();

export async function loadDayDetails(kind: RecordKind, date: string, signal?: AbortSignal): Promise<ReportRow[]> {
  const key = `${kind}|${date}`;
  const hit = detailsCache.get(key);
  if (hit) return hit;
  let rows = await fetchReportRows(endpointFor(kind), new URLSearchParams({ from: date, to: date }), signal);
  if (kind === "visits") {
    const visits = await fetchOpdVisitsRange(date, date, signal);
    const queues = new Map<string, OPDVisit[]>();
    visits.forEach((visit) => {
      const patientId = visit.patient?.patientId;
      if (!patientId) return;
      const key = visitKey(patientId, visit.date, text(visit.newReturning));
      const queue = queues.get(key);
      if (queue) queue.push(visit);
      else queues.set(key, [visit]);
    });
    rows = rows.map((row) => {
      const visit = queues.get(visitKey(text(row.patientId), text(row.date), text(row.newReturning)))?.shift();
      return visit
        ? {
            ...row,
            maritalStatus: visit.patient.maritalStatus ?? row.maritalStatus,
            remarks: visit.remarks ?? null,
            visitRecordedAt: visit.createdAt ?? null,
          }
        : row;
    });
  }
  if (detailsCache.size > 200) detailsCache.clear();
  detailsCache.set(key, rows);
  return rows;
}

export function clearDetailsCache() {
  detailsCache.clear();
}

export function fetchFullRows(
  kind: RecordKind,
  period: Period,
  today: string,
  signal: AbortSignal,
  onProgress: Progress,
  filters: ReportFilters = { maritalStatus: "", religion: "" }
) {
  const params = reportParams(period.from || EPOCH, minDate(period.to || today, today), filters);
  return fetchReportRows(endpointFor(kind), params, signal, onProgress);
}

/** Adds remarks and recording time to visit rows. A visit that cannot be matched keeps "—" instead of stopping the export. */
export async function attachRemarks(rows: ReportRow[], period: Period, today: string, signal: AbortSignal, onProgress: Progress) {
  const visits = await fetchOpdVisitsRange(period.from || EPOCH, period.to || today, signal, onProgress);
  const queues = new Map<string, OPDVisit[]>();
  visits.forEach((visit) => {
    const pid = visit.patient?.patientId;
    if (!pid || !visit.newReturning) return;
    const key = visitKey(pid, visit.date, visit.newReturning);
    const list = queues.get(key);
    if (list) list.push(visit);
    else queues.set(key, [visit]);
  });
  let unmatched = 0;
  const merged = rows.map((row) => {
    const match = queues.get(visitKey(text(row.patientId), text(row.date), text(row.newReturning)))?.shift();
    if (!match) {
      unmatched += 1;
      return row;
    }
    return {
      ...row,
      maritalStatus: match.patient.maritalStatus ?? row.maritalStatus,
      remarks: match.remarks ?? null,
      visitRecordedAt: match.createdAt ?? null,
    };
  });
  return { rows: merged, unmatched };
}
