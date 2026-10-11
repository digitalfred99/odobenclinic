"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bookmark, CalendarDays, ChevronLeft, ChevronRight, Ellipsis, Filter, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { getReportFilename } from "@/lib/reporting";
import {
  buildHeatmap, buildInsights, buildPyramid, buildQuality, buildRetention, buildTrend, dailyCounts, describeSlice,
  findDuplicates, findLapsed, findUnusualDays, matchesPatient, matchesVisit, parseCommand,
  rankBy, summarize, visitFrequency, weekdayStats,
} from "@/lib/reports/analytics";
import {
  FACILITY_NAME, PERSONAL_FIELDS, addVisitCounts, exportBrief, exportCsv, exportRecordsPdf, exportWorkbook,
  fieldValue, formatCell, getReportFields, type ExportContext, type ReportField,
} from "@/lib/reports/export";
import {
  attachRemarks, clearDetailsCache, fetchFullRows, loadPatients, loadVisits, normalizePatient, normalizeVisit,
} from "@/lib/reports/loader";
import { clearReportCache } from "@/lib/reports/cache";
import {
  PRESETS, addDays, bucketSizeFor, clinicToday, diffDays, minDate, periodLabel, previousPeriod, resolvePreset, shiftPeriod,
  type CompareMode, type PeriodPreset,
} from "@/lib/reports/period";
import { EMPTY_SLICE, type LoadProgress, type PatientRecord, type RecordKind, type Slice, type VisitRecord } from "@/lib/reports/types";
import type { ReportRow } from "@/types/report";
import { FilterSheet } from "@/components/reports/filter-sheet";
import { RecordsTable } from "@/components/reports/records-table";
import { BusySection, OverviewSection, PeopleSection, ReturningSection, type ReportModel } from "@/components/reports/sections";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "people", label: "People and places" },
  { id: "busy", label: "Busy hours" },
  { id: "returning", label: "Returning" },
  { id: "records", label: "Records" },
] as const;
type TabId = (typeof TABS)[number]["id"];
type ExportAction = "excel" | "csv" | "pdf" | "print";

const NO_VISITS: VisitRecord[] = [];
const NO_PATIENTS: PatientRecord[] = [];
const selectClass = "h-11 rounded-md border border-border bg-background px-3 text-sm";

/* ---------- small helpers ---------- */

function useClinicToday() {
  const [today, setToday] = useState(() => clinicToday());
  useEffect(() => {
    const sync = () => setToday(clinicToday());
    const id = window.setInterval(sync, 60_000);
    document.addEventListener("visibilitychange", sync);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", sync); };
  }, []);
  return today;
}

const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

function readUrl(params: URLSearchParams) {
  const wd = params.get("wd");
  const weekday = wd !== null && wd !== "" && Number(wd) >= 0 && Number(wd) <= 6 ? Number(wd) : null;
  const slice: Slice = {
    ...EMPTY_SLICE,
    sex: pick(params.get("sex"), ["", "male", "female", "other"] as const, ""),
    ageBand: params.get("age") ?? "",
    type: pick(params.get("type"), ["", "new", "returning", "unknown"] as const, ""),
    area: params.get("area") ?? "", town: params.get("town") ?? "", district: params.get("district") ?? "", region: params.get("region") ?? "",
    weekday,
    missing: pick(params.get("missing"), ["", "phone", "dob", "ghCard", "nhis", "area", "duplicate"] as const, ""),
  };
  return {
    preset: pick(params.get("period"), PRESETS.map((p) => p.value), "last30") as PeriodPreset,
    custom: { from: params.get("from") ?? "", to: params.get("to") ?? "" },
    compare: pick(params.get("compare"), ["previous", "lastYear", "none"] as const, "previous") as CompareMode,
    tab: pick(params.get("tab"), TABS.map((t) => t.id), "records") as TabId,
    kind: (params.get("kind") === "visits" ? "visits" : "patients") as RecordKind,
    slice,
  };
}

type SavedView = { id: string; name: string; preset: PeriodPreset; from: string; to: string; compare: CompareMode; slice: Slice; tab?: TabId; kind?: RecordKind };
type ExportLogEntry = { at: string; what: string; rows: number; period: string };

function readStore<T>(key: string, fallback: T): T {
  try { const raw = window.localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function writeStore(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

function Menu({ label, accessibleLabel, icon, open, onOpenChange, children }: { label: ReactNode; accessibleLabel: string; icon: ReactNode; open: boolean; onOpenChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <div className="relative">
      <button
        type="button" aria-label={accessibleLabel} aria-haspopup="menu" aria-expanded={open} onClick={() => onOpenChange(!open)}
        className="inline-flex h-9 min-h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-11 sm:min-h-11 sm:w-auto sm:gap-2 sm:px-4"
      >
        {icon}<span className="hidden sm:inline">{label}</span>
      </button>
      {open ? (
        <>
          <button type="button" aria-label="Close menu" tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => onOpenChange(false)} />
          <div role="menu" className="absolute right-0 z-50 mt-2 max-h-[calc(100dvh-5rem)] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-lg" onClick={() => onOpenChange(false)}>
            {children}
          </div>
        </>
      ) : null}
    </div>
  );
}
const MenuItem = ({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) => (
  <button type="button" role="menuitem" disabled={disabled} onClick={onClick}
    className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm text-foreground hover:bg-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    {children}
  </button>
);

/* ---------- the page ---------- */

function ReportsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const today = useClinicToday();
  const [initial] = useState(() => readUrl(new URLSearchParams(searchParams.toString())));

  const [preset, setPreset] = useState<PeriodPreset>(initial.preset);
  const [custom, setCustom] = useState(initial.custom);
  const [compare, setCompare] = useState<CompareMode>(initial.compare);
  const [slice, setSlice] = useState<Slice>(initial.slice);
  const [tab, setTab] = useState<TabId>(initial.tab);
  const [recordsKind, setRecordsKind] = useState<RecordKind>(initial.kind);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [rangeDialogOpen, setRangeDialogOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [command, setCommand] = useState("");
  const [historyOn, setHistoryOn] = useState(false);
  const [nonce, setNonce] = useState(0);
  const refreshNonce = useRef(-1);
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const commandRef = useRef<HTMLInputElement>(null);

  const [views, setViews] = useState<SavedView[]>([]);
  const [exportLog, setExportLog] = useState<ExportLogEntry[]>([]);
  useEffect(() => {
    // Saved views and export history are client-only preferences; hydrate them after SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setViews(readStore<SavedView[]>("clinic-report-views", []));
    setExportLog(readStore<ExportLogEntry[]>("clinic-report-export-log", []));
  }, []);

  const [fieldAction, setFieldAction] = useState<ExportAction | null>(null);
  const [draftFields, setDraftFields] = useState<ReportField[]>([]);
  const [exportJob, setExportJob] = useState<LoadProgress | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const exportController = useRef<AbortController | null>(null);
  const [print, setPrint] = useState<{ kind: RecordKind; fields: ReportField[]; rows: ReportRow[] } | null>(null);

  const period = useMemo(() => resolvePreset(preset, today, custom), [preset, today, custom]);
  const periodError = preset === "custom" && custom.from && custom.to && custom.from > custom.to
    ? "The start date must be on or before the end date."
    : null;
  const prev = useMemo(() => (compare === "none" ? null : previousPeriod(period, compare)), [period, compare]);
  const prevLabel = compare === "lastYear" ? "the same period last year" : "the previous period";

  /* ----- data ----- */
  const queryOpts = { staleTime: 5 * 60_000, refetchOnWindowFocus: false } as const;
  const refreshNow = () => refreshNonce.current === nonce;

  const visitsQ = useQuery({
    ...queryOpts, queryKey: ["rpt-visits", period.from, period.to, nonce],
    enabled: !periodError,
    queryFn: ({ signal }) => loadVisits(period, today, signal, setProgress, refreshNow()),
  });
  const patientsQ = useQuery({
    ...queryOpts, queryKey: ["rpt-patients", period.from, period.to, nonce],
    enabled: !periodError,
    queryFn: ({ signal }) => loadPatients(period, today, signal, setProgress, refreshNow()),
  });
  const compareReady = Boolean(prev) && visitsQ.isSuccess && patientsQ.isSuccess;
  const prevVisitsQ = useQuery({
    ...queryOpts, queryKey: ["rpt-visits", prev?.from, prev?.to, nonce], enabled: compareReady,
    queryFn: ({ signal }) => loadVisits(prev!, today, signal, setProgress, refreshNow()),
  });
  const prevPatientsQ = useQuery({
    ...queryOpts, queryKey: ["rpt-patients", prev?.from, prev?.to, nonce], enabled: compareReady,
    queryFn: ({ signal }) => loadPatients(prev!, today, signal, setProgress, refreshNow()),
  });
  const historyQ = useQuery({
    ...queryOpts, queryKey: ["rpt-visits", "history", nonce], enabled: historyOn && visitsQ.isSuccess,
    queryFn: ({ signal }) => loadVisits({ preset: "all", from: "", to: "" }, today, signal, setProgress, refreshNow()),
  });

  const anyFetching = [visitsQ, patientsQ, prevVisitsQ, prevPatientsQ, historyQ].some((q) => q.isFetching);
  useEffect(() => { if (!anyFetching) refreshNonce.current = -1; }, [anyFetching]);

  const cancelLoading = () => queryClient.cancelQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("rpt-") });
  const refreshEverything = () => { clearDetailsCache(); refreshNonce.current = nonce + 1; setNonce(nonce + 1); };

  /* ----- analysis (all in the browser) ----- */
  const visits = visitsQ.data?.rows ?? NO_VISITS;
  const patients = patientsQ.data?.rows ?? NO_PATIENTS;
  const dup = useMemo(() => findDuplicates(patients), [patients]);
  const sliceNoMissing = useMemo<Slice>(() => ({ ...slice, missing: "" }), [slice]);

  const slicedVisits = useMemo(() => visits.filter((v) => matchesVisit(v, slice)), [visits, slice]);
  const slicedPatients = useMemo(() => patients.filter((p) => matchesPatient(p, slice, dup.pids)), [patients, slice, dup]);
  const newRecords = useMemo(() => patients.filter((p) => matchesPatient(p, sliceNoMissing, dup.pids)), [patients, sliceNoMissing, dup]);
  const prevVisits = useMemo(() => (prevVisitsQ.data?.rows ?? NO_VISITS).filter((v) => matchesVisit(v, slice)), [prevVisitsQ.data, slice]);
  const prevPatients = useMemo(() => (prevPatientsQ.data?.rows ?? NO_PATIENTS).filter((p) => matchesPatient(p, sliceNoMissing, new Set())), [prevPatientsQ.data, sliceNoMissing]);

  const firstVisit = useMemo(() => visits.reduce((min, v) => (v.date < min ? v.date : min), today), [visits, today]);
  const rangeFrom = period.from || firstVisit;
  const rangeTo = minDate(period.to || today, today);
  const days = Math.max(1, diffDays(rangeFrom, rangeTo) + 1);
  const size = bucketSizeFor(days);

  const model: ReportModel = useMemo(() => {
    const summary = summarize(slicedVisits, newRecords.length, days);
    const prevSummary = prev && prevVisitsQ.data && prevPatientsQ.data ? summarize(prevVisits, prevPatients.length, diffDays(prev.from, prev.to) + 1) : null;
    const trend = buildTrend(slicedVisits, rangeFrom, rangeTo, size);
    const ghost = prev && prevVisitsQ.data ? buildTrend(prevVisits, prev.from, prev.to, size).map((b) => b.total) : undefined;

    const counts = dailyCounts(slicedVisits);
    const statsTo = minDate(rangeTo, addDays(today, -1));
    const stats = rangeFrom <= statsTo ? weekdayStats(counts, rangeFrom, statsTo) : { totals: Array<number>(7).fill(0), typical: Array<number>(7).fill(0), sampleSize: Array<number>(7).fill(0) };
    const unusual = rangeFrom <= statsTo ? findUnusualDays(counts, rangeFrom, statsTo, stats.typical, stats.sampleSize) : [];

    const pyramid = buildPyramid(slicedVisits);
    const areas = rankBy(slicedVisits, (v) => v.area, 10);
    const heat = buildHeatmap(slicedVisits);
    const historyRows = (historyQ.data?.rows ?? NO_VISITS).filter((v) => matchesVisit(v, { ...slice, type: "", weekday: null }));

    return {
      summary, prev: prevSummary, prevLabel, trend, ghost,
      insights: buildInsights({ summary, prev: prevSummary, prevLabel, weekdayTotals: stats.totals, heat, pyramid, areas }),
      unusual, pyramid, areas, towns: rankBy(slicedVisits, (v) => v.town, 10),
      quality: buildQuality(newRecords), duplicates: dup, heat,
      weekday: { totals: stats.totals, typical: stats.typical },
      frequency: visitFrequency(slicedVisits),
      history: historyOn ? { loading: !historyQ.data && !historyQ.error, failed: Boolean(historyQ.error), retention: buildRetention(historyRows, today), lapsed: findLapsed(historyRows, today) } : null,
      slice,
      actions: {
        setSlice,
        zoomTo: (b) => { setPreset("custom"); setCustom({ from: b.start, to: b.end }); },
        openRecords: (kind, partial) => { setSlice((s) => ({ ...s, ...partial })); setRecordsKind(kind); setTab("records"); },
        buildHistory: () => setHistoryOn(true),
        exportLapsed: () => {
          const lapsed = findLapsed((historyQ.data?.rows ?? NO_VISITS).filter((v) => matchesVisit(v, { ...slice, type: "", weekday: null })), today);
          void exportCsv(["OPD No.", "Visits", "Last seen", "Days since last visit", "Age", "Sex", "Area"],
            lapsed.map((p) => [p.pid.replace(/^PT-/, ""), p.visits, p.lastDate, p.daysSince, p.age ?? "", p.sex, p.area]), `lapsed-patients_${today}.csv`);
        },
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slicedVisits, newRecords, prevVisits, prevPatients, prevVisitsQ.data, prevPatientsQ.data, historyQ.data, historyQ.isLoading, historyQ.error, historyOn, slice, dup, days, rangeFrom, rangeTo, size, today, prev, prevLabel]);

  const vocab = useMemo(() => {
    const sets = { areas: new Set<string>(), towns: new Set<string>(), districts: new Set<string>(), regions: new Set<string>() };
    [...visits, ...patients].forEach((r) => { if (r.area) sets.areas.add(r.area); if (r.town) sets.towns.add(r.town); if (r.district) sets.districts.add(r.district); if (r.region) sets.regions.add(r.region); });
    return { areas: [...sets.areas].sort(), towns: [...sets.towns].sort(), districts: [...sets.districts].sort(), regions: [...sets.regions].sort() };
  }, [visits, patients]);

  const chips = describeSlice(slice);
  const parsed = useMemo(() => parseCommand(command, vocab), [command, vocab]);
  const records = recordsKind === "visits" ? slicedVisits : slicedPatients;
  const clockBehind = useMemo(() => visits.some((v) => v.date > today), [visits, today]);
  const warnings = [...new Set([...(visitsQ.data?.warnings ?? []), ...(patientsQ.data?.warnings ?? [])])];
  const label = periodLabel(period);
  const filterSummary = chips.map((c) => c.label).join(", ");
  const loading = visitsQ.isLoading || patientsQ.isLoading;
  const failed = Boolean(visitsQ.error || patientsQ.error);

  /* ----- URL sync ----- */
  useEffect(() => {
    const p = new URLSearchParams();
    p.set("period", preset); p.set("tab", tab); p.set("compare", compare); p.set("kind", recordsKind);
    if (preset === "custom") { if (custom.from) p.set("from", custom.from); if (custom.to) p.set("to", custom.to); }
    const entries: [string, string][] = [["sex", slice.sex], ["age", slice.ageBand], ["type", slice.type], ["area", slice.area], ["town", slice.town], ["district", slice.district], ["region", slice.region], ["wd", slice.weekday === null ? "" : String(slice.weekday)], ["missing", slice.missing]];
    entries.forEach(([k, v]) => { if (v) p.set(k, v); });
    router.replace(`${pathname}?${p}`, { scroll: false });
  }, [preset, custom, compare, tab, recordsKind, slice, pathname, router]);

  /* ----- toolbar actions ----- */
  const choosePreset = (next: PeriodPreset) => {
    if (next === "custom") setCustom({ from: period.from, to: period.to });
    setPreset(next);
  };
  const shift = (dir: 1 | -1) => { const n = shiftPeriod(period, dir); setPreset("custom"); setCustom({ from: n.from, to: n.to }); };
  const removeChip = (key: keyof Slice) => setSlice((s) => ({ ...s, [key]: key === "weekday" ? null : "" }));

  const applyCommand = () => {
    if (!command.trim()) return;
    if (parsed.preset) setPreset(parsed.preset);
    setSlice((s) => ({ ...s, ...parsed.slice }));
    setCommand(parsed.leftover);
  };

  const saveView = () => setSaveViewOpen(true);
  const confirmSaveView = () => {
    if (!viewName.trim()) return;
    const next = [...views, { id: String(Date.now()), name: viewName.trim(), preset, from: custom.from, to: custom.to, compare, slice, tab, kind: recordsKind }];
    setViews(next); writeStore("clinic-report-views", next);
    setViewName("");
    setSaveViewOpen(false);
  };
  const applyView = (v: SavedView) => {
    setPreset(v.preset); setCustom({ from: v.from, to: v.to }); setCompare(v.compare); setSlice(v.slice);
    setTab(v.tab ?? "records"); setRecordsKind(v.kind ?? "patients");
  };
  const deleteView = (id: string) => { const next = views.filter((v) => v.id !== id); setViews(next); writeStore("clinic-report-views", next); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, select, textarea, [contenteditable='true']") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (filtersOpen || fieldAction) return;
      if (e.key === "/") { e.preventDefault(); commandRef.current?.focus(); }
      else if (e.key === "[") shift(-1);
      else if (e.key === "]") shift(1);
      else if (e.key === "e") setActionsMenuOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ----- exports ----- */
  const fieldOptions = getReportFields(recordsKind);

  const buildContext = (): ExportContext => ({
    facility: FACILITY_NAME, periodLabel: label, filterSummary, generatedAt: format(new Date(), "d MMM yyyy, HH:mm"),
    summary: model.summary, prev: model.prev, prevLabel, trend: model.trend, ghost: model.ghost, pyramid: model.pyramid,
    areas: model.areas, heat: model.heat, weekday: model.weekday, insights: model.insights, quality: model.quality,
  });

  const logExport = (what: string, rows: number) => {
    const next = [{ at: format(new Date(), "d MMM yyyy, HH:mm"), what, rows, period: label }, ...exportLog].slice(0, 20);
    setExportLog(next); writeStore("clinic-report-export-log", next);
  };

  const runBrief = async () => {
    try { await exportBrief(buildContext(), `chiefs-brief_${period.from || "all"}_${period.to || today}.pdf`); logExport("Chief's brief (PDF)", model.summary.visits); }
    catch (e) { setExportStatus(`Export failed: ${e instanceof Error ? e.message : "Please try again."}`); }
  };

  const startFieldSelection = (action: ExportAction) => { setDraftFields(fieldOptions.map((f) => f.key)); setFieldAction(action); };

  const runRecordsExport = async (action: ExportAction, fields: ReportField[]) => {
    const controller = new AbortController();
    exportController.current = controller;
    setExportStatus(null);
    setExportJob({ label: "Preparing export", done: 0, total: 0 });
    try {
      const kind = recordsKind;
      let rows = await fetchFullRows(kind, period, today, controller.signal, (done, total) => setExportJob({ label: "Loading records", done, total }));
      rows = rows.filter((row) => {
        if (kind === "visits") { const rec = normalizeVisit(row, null); return rec ? matchesVisit(rec, slice) : false; }
        const rec = normalizePatient(row);
        return rec ? matchesPatient(rec, slice, dup.pids) : false;
      });
      if (rows.length === 0) { setExportStatus("Export failed: no records match the current period and filters."); return; }

      let unmatched = 0;
      if (kind === "visits") {
        const merged = await attachRemarks(rows, period, today, controller.signal, (done, total) => setExportJob({ label: "Loading visit remarks", done, total }));
        rows = addVisitCounts(merged.rows);
        unmatched = merged.unmatched;
      }

      const selected = getReportFields(kind).filter((f) => fields.includes(f.key));
      const headers = selected.map((f) => f.label);
      const table = rows.map((row) => selected.map((f) => formatCell(fieldValue(row, kind, f.key))));
      const type = kind === "visits" ? "opd-visits" : "patients";
      const range = { from: period.from, to: period.to };

      if (action === "print") {
        setPrint({ kind, fields: selected.map((f) => f.key), rows });
        window.setTimeout(() => window.print(), 100);
      } else if (action === "excel") {
        await exportWorkbook(buildContext(), { name: kind === "visits" ? "OPD visits" : "Patient registrations", headers, rows: table }, getReportFilename(type, range, "xlsx"));
      } else if (action === "csv") {
        await exportCsv(headers, table, getReportFilename(type, range, "csv"));
      } else {
        await exportRecordsPdf({
          title: kind === "visits" ? "OPD visit report" : "Patient registration report",
          subtitle: `${label}  |  ${rows.length.toLocaleString()} rows${filterSummary ? `  |  ${filterSummary}` : ""}`,
          headers, rows: table, filename: getReportFilename(type, range, "pdf"),
        });
      }
      logExport(`${action === "excel" ? "Excel" : action.toUpperCase()}: ${kind === "visits" ? "visits" : "patients"}`, rows.length);
      setExportStatus(`${action === "print" ? "Prepared" : "Exported"} ${rows.length.toLocaleString()} rows.${unmatched ? ` ${unmatched} visits had no remarks match and show a dash.` : ""}`);
    } catch (e) {
      setExportStatus(controller.signal.aborted ? "Export cancelled." : `Export failed: ${e instanceof Error ? e.message : "Please try again."}`);
    } finally {
      exportController.current = null;
      setExportJob(null);
    }
  };

  const confirmFields = () => {
    if (!fieldAction || draftFields.length === 0) return;
    const action = fieldAction;
    setFieldAction(null);
    void runRecordsExport(action, draftFields);
  };
  const includesPersonal = draftFields.some((f) => PERSONAL_FIELDS.includes(f));
  const busyExporting = exportJob !== null;

  /* ----- render ----- */
  return (
    <div className="print-report">
      <div className="space-y-5 print:hidden">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Reports</h2>
        <div className="sticky top-16 z-20 -mx-4 border-y border-border bg-background/95 px-2 py-1.5 shadow-sm backdrop-blur sm:px-4 lg:top-0">
          <div className="flex h-10 w-full items-center gap-1 sm:gap-2">
          <label className="sr-only" htmlFor="rpt-period">Period</label>
          <select id="rpt-period" className={`${selectClass} h-9 min-w-0 flex-1 px-2 text-xs sm:h-11 sm:flex-none sm:px-3 sm:text-sm`} value={preset} onChange={(e) => choosePreset(e.target.value as PeriodPreset)}>
            {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          {preset !== "custom" ? (
            <>
              <button type="button" aria-label="Earlier period" onClick={() => shift(-1)} disabled={!period.from} className="inline-flex h-9 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-card hover:bg-muted disabled:opacity-50 sm:h-11 sm:w-11"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" aria-label="Later period" onClick={() => shift(1)} disabled={!period.from} className="inline-flex h-9 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-card hover:bg-muted disabled:opacity-50 sm:h-11 sm:w-11"><ChevronRight className="h-4 w-4" /></button>
            </>
          ) : null}
          {preset === "custom" ? (
            <>
              <button type="button" aria-label="Choose custom date range" onClick={() => setRangeDialogOpen(true)} className="inline-flex h-9 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-muted sm:hidden">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
              </button>
              <div className="hidden shrink-0 items-center gap-2 sm:flex">
                <input aria-label="From date" type="date" value={custom.from} max={custom.to || undefined} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className={selectClass} />
                <input aria-label="To date" type="date" value={custom.to} min={custom.from || undefined} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className={selectClass} />
              </div>
            </>
          ) : <span className="hidden shrink-0 whitespace-nowrap px-1 text-sm text-muted-foreground sm:inline">{label}</span>}
          <label className="sr-only" htmlFor="rpt-compare">Compare with</label>
            <select id="rpt-compare" className={`${selectClass} h-9 min-w-0 flex-1 px-1 text-xs sm:h-11 sm:flex-none sm:px-3 sm:text-sm`} value={compare} onChange={(e) => setCompare(e.target.value as CompareMode)}>
              <option value="previous">Previous</option><option value="lastYear">Last year</option><option value="none">None</option>
            </select>
          <Menu label="Actions" accessibleLabel="Report actions" icon={<Ellipsis className="h-4 w-4" aria-hidden="true" />} open={actionsMenuOpen} onOpenChange={setActionsMenuOpen}>
            <MenuItem onClick={refreshEverything} disabled={anyFetching}><RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />Refresh report</MenuItem>
            <MenuItem onClick={() => setFiltersOpen(true)}><Filter className="mr-2 h-4 w-4" aria-hidden="true" />Filters{chips.length ? ` (${chips.length})` : ""}</MenuItem>
            <div className="my-1 border-t border-border" />
            <MenuItem onClick={saveView}><Bookmark className="mr-2 h-4 w-4" aria-hidden="true" />Save current view…</MenuItem>
            {views.length > 0 ? <p className="px-3 py-2 text-xs font-semibold text-muted-foreground">Saved on this device</p> : <p className="px-3 py-2 text-xs text-muted-foreground">Saved views will appear here.</p>}
            {views.map((v) => (
              <div key={v.id} className="flex items-center">
                <button type="button" role="menuitem" onClick={() => applyView(v)} className="min-h-11 flex-1 rounded-lg px-3 text-left text-sm hover:bg-muted">{v.name}</button>
                <button type="button" aria-label={`Delete view ${v.name}`} onClick={(e) => { e.stopPropagation(); deleteView(v.id); }} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
              </div>
            ))}
            <div className="my-1 border-t border-border" />
            <MenuItem onClick={() => void runBrief()} disabled={loading || failed || Boolean(periodError)}>Chief’s brief (PDF)</MenuItem>
            <MenuItem onClick={() => startFieldSelection("excel")} disabled={loading || busyExporting || Boolean(periodError)}>Export Excel</MenuItem>
            <MenuItem onClick={() => startFieldSelection("csv")} disabled={loading || busyExporting || Boolean(periodError)}>Export CSV</MenuItem>
            <MenuItem onClick={() => startFieldSelection("pdf")} disabled={loading || busyExporting || Boolean(periodError)}>Export PDF</MenuItem>
            <MenuItem onClick={() => startFieldSelection("print")} disabled={loading || busyExporting || Boolean(periodError)}>Print report</MenuItem>
            <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">Record exports use the “{recordsKind === "visits" ? "Visits" : "Patients"}” list. Recent: {exportLog[0] ? `${exportLog[0].what}, ${exportLog[0].rows.toLocaleString()} rows` : "none"}</p>
          </Menu>
        </div>
        </div>
        {periodError ? <p className="text-sm text-destructive" role="alert">{periodError}</p> : null}

        <div>
          <input
            ref={commandRef} type="text" value={command} onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") applyCommand(); }}
            placeholder='Type to filter, for example "female returning last month". Press / to jump here.'
            aria-label="Type to filter"
            className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
          />
          {command.trim() ? (
            <p className="mt-1 text-xs text-muted-foreground" role="status">
              {parsed.summary.length ? `Press Enter to apply: ${parsed.summary.join(", ")}.` : "Nothing recognised yet."}
              {parsed.leftover && parsed.summary.length ? ` Not understood: ${parsed.leftover}.` : ""}
            </p>
          ) : null}
        </div>

        {chips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
            {chips.map((c) => (
              <button key={c.key} type="button" aria-label={`Remove filter: ${c.label}`} onClick={() => removeChip(c.key)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-muted/50 px-4 text-sm text-foreground">
                {c.label}<X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ))}
            <button type="button" onClick={() => setSlice(EMPTY_SLICE)} className="min-h-11 px-2 text-sm font-medium text-primary underline-offset-4 hover:underline">Clear all</button>
          </div>
        ) : null}

        {anyFetching && progress ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 p-3" role="status" aria-live="polite">
            <div className="min-w-40 flex-1">
              <p className="text-sm font-medium text-foreground">{progress.label}</p>
              {progress.total > 0 ? <progress className="mt-2 h-2 w-full accent-primary" value={progress.done} max={progress.total} aria-label={`${progress.label} progress`} /> : null}
            </div>
            <Button type="button" variant="secondary" className="min-h-11" onClick={() => void cancelLoading()}>Cancel</Button>
          </div>
        ) : null}
        {exportJob ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 p-3" role="status" aria-live="polite">
            <div className="min-w-40 flex-1">
              <p className="text-sm font-medium text-foreground">{exportJob.label}</p>
              {exportJob.total > 0 ? <progress className="mt-2 h-2 w-full accent-primary" value={exportJob.done} max={exportJob.total} aria-label="Export progress" /> : null}
            </div>
            <Button type="button" variant="secondary" className="min-h-11" onClick={() => exportController.current?.abort()}>Cancel export</Button>
          </div>
        ) : null}
        {exportStatus ? <FeedbackMessage message={exportStatus} kind={exportStatus.includes("failed") ? "error" : "success"} onDismiss={() => setExportStatus(null)} /> : null}
        {clockBehind ? <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">This computer’s clock looks behind: the report contains visits dated after today. Period shortcuts such as “Today” may be wrong until the clock is corrected.</div> : null}
        {warnings.map((w) => <p key={w} className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground" role="status">{w}</p>)}
        {failed ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
            Unable to load the report. If you were offline, closed days saved earlier still show.
            <button type="button" className="ml-2 inline-flex min-h-11 items-center font-medium underline underline-offset-4" onClick={refreshEverything}>Try again</button>
          </div>
        ) : null}

        <div role="tablist" aria-label="Report sections" className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} onClick={() => setTab(t.id)}
              className={`min-h-11 shrink-0 border-b-2 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {loading ? (
            <div className="space-y-3" role="status" aria-label="Loading report" aria-busy="true">
              <div className="h-40 animate-pulse rounded-xl bg-muted" /><div className="h-64 animate-pulse rounded-xl bg-muted" />
            </div>
          ) : failed && visits.length === 0 ? null : tab === "overview" ? <OverviewSection m={model} />
            : tab === "people" ? <PeopleSection m={model} />
            : tab === "busy" ? <BusySection m={model} />
            : tab === "returning" ? <ReturningSection m={model} />
            : (
              <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{recordsKind === "visits" ? "OPD Visit Report" : "Patient Registration Report"}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Period: {label} <span aria-hidden="true">|</span> Total: {records.length.toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2" role="group" aria-label="Record type">
                    <Button type="button" className="min-h-11" variant={recordsKind === "visits" ? "default" : "secondary"} aria-pressed={recordsKind === "visits"} onClick={() => setRecordsKind("visits")}>OPD visits</Button>
                    <Button type="button" className="min-h-11" variant={recordsKind === "patients" ? "default" : "secondary"} aria-pressed={recordsKind === "patients"} onClick={() => setRecordsKind("patients")}>Patient registrations</Button>
                  </div>
                </div>
                <RecordsTable
                  key={recordsKind}
                  kind={recordsKind}
                  records={records}
                  missingKey={slice.missing}
                  duplicateGroups={dup.groups}
                />
              </section>
            )}
        </div>

        <p className="flex flex-wrap items-center gap-x-4 text-xs text-muted-foreground">
          <span>Days older than two days are saved on this computer for faster loading{visitsQ.data?.usedCache ? " (used for this report)" : ""}. Saved data holds no names, phone numbers or card numbers.</span>
          <button type="button" className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => { void clearReportCache(); clearDetailsCache(); setExportStatus("Saved report data cleared. The next report loads from the server."); }}>
            Clear saved report data
          </button>
        </p>
      </div>

      {print ? (
        <div className="hidden print:block">
          <p className="font-semibold">{FACILITY_NAME}</p>
          <p className="text-sm">{print.kind === "visits" ? "OPD visit report" : "Patient registration report"} | {label}{filterSummary ? ` | ${filterSummary}` : ""} | {print.rows.length.toLocaleString()} rows</p>
          <table className="mt-3 w-full text-left text-xs">
            <thead><tr className="border-b border-border">{print.fields.map((f) => <th key={f} className="px-2 py-2 font-semibold">{getReportFields(print.kind).find((o) => o.key === f)?.label}</th>)}</tr></thead>
            <tbody>
              {print.rows.map((row, i) => (
                <tr key={i} className="border-b border-border">
                  {print.fields.map((f) => <td key={f} className="px-2 py-2">{String(formatCell(fieldValue(row, print.kind, f)))}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-6 text-xs">Prepared by: ______________________   Date: ____________   Signature: ____________________</p>
        </div>
      ) : null}

      <FilterSheet open={filtersOpen} onOpenChange={setFiltersOpen} slice={slice} onChange={setSlice} vocab={vocab} />

      <Dialog.Root open={rangeDialogOpen} onOpenChange={setRangeDialogOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-[100] bg-foreground/40 print:hidden" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-[101] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl outline-none print:hidden">
            <Dialog.Title className="text-lg font-semibold text-foreground">Choose date range</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">Select the first and last date to include in this report.</Dialog.Description>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium text-foreground">
                From
                <input aria-label="From date" type="date" value={custom.from} max={custom.to || undefined} onChange={(event) => setCustom((value) => ({ ...value, from: event.target.value }))} className={`${selectClass} w-full`} />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-foreground">
                To
                <input aria-label="To date" type="date" value={custom.to} min={custom.from || undefined} onChange={(event) => setCustom((value) => ({ ...value, to: event.target.value }))} className={`${selectClass} w-full`} />
              </label>
            </div>
            {periodError ? <p className="mt-3 text-sm text-destructive" role="alert">{periodError}</p> : null}
            <div className="mt-6 flex justify-end">
              <Button type="button" className="min-h-11" disabled={!custom.from || !custom.to || Boolean(periodError)} onClick={() => setRangeDialogOpen(false)}>Apply range</Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={saveViewOpen} onOpenChange={(open) => { setSaveViewOpen(open); if (!open) setViewName(""); }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-[100] bg-foreground/40 print:hidden" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-[101] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl outline-none print:hidden">
            <Dialog.Title className="text-lg font-semibold text-foreground">Save this report view</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
              Save the current period, comparison, filters, report section and record type on this device.
            </Dialog.Description>
            <label htmlFor="saved-view-name" className="mt-5 block text-sm font-medium text-foreground">View name</label>
            <input
              id="saved-view-name"
              autoFocus
              maxLength={60}
              value={viewName}
              onChange={(event) => setViewName(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") confirmSaveView(); }}
              placeholder="For example, monthly OPD visits"
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
            />
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" className="min-h-11" onClick={() => setSaveViewOpen(false)}>Cancel</Button>
              <Button type="button" className="min-h-11" disabled={!viewName.trim()} onClick={confirmSaveView}>Save view</Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={fieldAction !== null} onOpenChange={(open) => { if (!open) setFieldAction(null); }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-[100] bg-foreground/40 print:hidden" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-[101] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl outline-none print:hidden">
            <Dialog.Title className="text-lg font-semibold text-foreground">Choose fields to {fieldAction === "print" ? "print" : "export"}</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
              {recordsKind === "visits" ? "OPD visits" : "Patient registrations"} matching the current period and filters. All matching rows are included, not just the page on screen.
            </Dialog.Description>
            <div className="mt-5 space-y-3">
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm font-medium">
                <input type="checkbox" className="h-4 w-4 accent-primary" checked={draftFields.length === fieldOptions.length} onChange={(e) => setDraftFields(e.target.checked ? fieldOptions.map((f) => f.key) : [])} />
                Select all fields
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {fieldOptions.map((f) => (
                  <label key={f.key} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
                    <input type="checkbox" className="h-4 w-4 accent-primary" checked={draftFields.includes(f.key)} onChange={(e) => setDraftFields((cur) => (e.target.checked ? [...cur, f.key] : cur.filter((x) => x !== f.key)))} />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>
            {includesPersonal ? <p className="mt-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">These columns include personal information (names, phone or ID numbers). Keep the file confidential and delete it when you are done.</p> : null}
            {draftFields.length === 0 ? <p className="mt-3 text-sm text-destructive" role="alert">Select at least one field to continue.</p> : null}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" className="min-h-11" onClick={() => setFieldAction(null)}>Cancel</Button>
              <Button type="button" className="min-h-11" disabled={draftFields.length === 0} onClick={confirmFields}>
                {fieldAction === "print" ? "Print report" : fieldAction === "excel" ? "Export Excel" : `Export ${fieldAction?.toUpperCase()}`}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="space-y-3" role="status" aria-label="Loading report"><div className="h-12 animate-pulse rounded-xl bg-muted" /><div className="h-64 animate-pulse rounded-xl bg-muted" /></div>}>
      <ReportsPageContent />
    </Suspense>
  );
}
