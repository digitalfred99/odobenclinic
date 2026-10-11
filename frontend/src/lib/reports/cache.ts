import { addDays } from "./period";

/**
 * Saves finished days in the browser (IndexedDB) so big reports open fast and past data
 * still shows when the internet drops. If IndexedDB is unavailable (private mode, old
 * browser) every function quietly does nothing and the page just loads from the server.
 */
const DB_NAME = "clinic-report-cache";
const SCHEMA = "v2"; // bump when the saved row shape changes
export type DateRange = [string, string];

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("days");
        request.result.createObjectStore("coverage");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

const wrap = <T,>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

const prefix = (kind: string) => `${SCHEMA}:${kind}`;

export function mergeRanges(ranges: DateRange[]): DateRange[] {
  const sorted = [...ranges].sort((a, b) => a[0].localeCompare(b[0]));
  const merged: DateRange[] = [];
  for (const [from, to] of sorted) {
    const last = merged[merged.length - 1];
    if (last && from <= addDays(last[1], 1)) {
      if (to > last[1]) last[1] = to;
    } else merged.push([from, to]);
  }
  return merged;
}

/** The parts of `target` that `covered` does not already contain. */
export function subtractRange(target: DateRange, covered: DateRange[]): DateRange[] {
  const gaps: DateRange[] = [];
  let cursor = target[0];
  for (const [from, to] of mergeRanges(covered)) {
    if (to < cursor) continue;
    if (from > target[1]) break;
    if (from > cursor) gaps.push([cursor, addDays(from, -1)]);
    const next = addDays(to, 1);
    if (next > cursor) cursor = next;
  }
  if (cursor <= target[1]) gaps.push([cursor, target[1]]);
  return gaps;
}

export async function getCoverage(kind: string): Promise<DateRange[]> {
  const db = await openDb();
  if (!db) return [];
  try {
    const value = await wrap(db.transaction("coverage").objectStore("coverage").get(prefix(kind)));
    return Array.isArray(value) ? (value as DateRange[]) : [];
  } catch {
    return [];
  }
}

export async function readDays<T>(kind: string, from: string, to: string): Promise<T[]> {
  const db = await openDb();
  if (!db) return [];
  try {
    const range = IDBKeyRange.bound(`${prefix(kind)}|${from}`, `${prefix(kind)}|${to}\uffff`);
    const days = await wrap(db.transaction("days").objectStore("days").getAll(range));
    return (days as { rows: T[] }[]).flatMap((day) => day.rows);
  } catch {
    return [];
  }
}

/** Replaces everything saved for [from, to] and marks it as fully loaded. Returns false if saving failed. */
export async function storeClosedRange<T>(kind: string, from: string, to: string, rowsByDate: Map<string, T[]>): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  try {
    const merged = mergeRanges([...(await getCoverage(kind)), [from, to]]);
    const tx = db.transaction(["days", "coverage"], "readwrite");
    const days = tx.objectStore("days");
    days.delete(IDBKeyRange.bound(`${prefix(kind)}|${from}`, `${prefix(kind)}|${to}\uffff`));
    rowsByDate.forEach((rows, date) => days.put({ rows }, `${prefix(kind)}|${date}`));
    tx.objectStore("coverage").put(merged, prefix(kind));
    await done(tx);
    return true;
  } catch {
    return false;
  }
}

/** Call this on logout, and from the "Clear saved report data" button. */
export async function clearReportCache(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(["days", "coverage"], "readwrite");
    tx.objectStore("days").clear();
    tx.objectStore("coverage").clear();
    await done(tx);
  } catch {
    /* nothing to clear */
  }
}
