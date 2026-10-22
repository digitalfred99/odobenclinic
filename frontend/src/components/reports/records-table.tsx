"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiRequest } from "@/lib/api";
import { formatPatientDisplayId, formatReportDate, formatReportDateTime } from "@/lib/reporting";
import { hourOf, placeLabel } from "@/lib/reports/analytics";
import { fetchOpdVisitDayDetails, loadDayDetails } from "@/lib/reports/loader";
import type { MissingKey, PatientRecord, RecordKind, VisitRecord } from "@/lib/reports/types";
import type { OPDVisit } from "@/types/opd";
import type { PatientListResponse } from "@/types/patient";
import type { ReportRow } from "@/types/report";
import { patientReligionLabel } from "@/types/patient";
import { formatPatientName } from "@/lib/patient-name";

type Rec = VisitRecord | PatientRecord;
type SortKey = "date" | "pid" | "age" | "sex" | "area";

const selectClass = "h-11 rounded-md border border-border bg-background px-3 text-sm";

function RecordChecks({ message, missing }: { message: string | null; missing: string[] }) {
  if (missing.length === 0 || !message?.startsWith("Missing")) {
    return <span>{message}</span>;
  }

  return (
    <details className="group min-w-40">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-left text-sm text-foreground outline-none transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block font-medium">{missing.length} Missing details</span>
          <span className="block text-xs text-muted-foreground">View missing items</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <ul className="mt-2 space-y-1.5 rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground">
        {missing.map((item) => <li key={item}>Missing {item}</li>)}
      </ul>
    </details>
  );
}

function DesktopRecordChecks({ patientId, message, missing }: {
  patientId: string;
  message: string | null;
  missing: string[];
}) {
  const [hovered, setHovered] = useState(false);
  const [tooltipHovered, setTooltipHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detailsId = `record-checks-${patientId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const open = hovered || tooltipHovered || focused || pinned;

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  useEffect(() => {
    if (!open) return;

    const dismissOnOutsidePointer = (event: PointerEvent) => {
      if (triggerRef.current?.contains(event.target as Node)) return;
      setPinned(false);
      setFocused(false);
      setHovered(false);
      setTooltipHovered(false);
    };

    document.addEventListener("pointerdown", dismissOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", dismissOnOutsidePointer);
  }, [open]);

  if (missing.length === 0 || !message?.startsWith("Missing")) {
    return <span>{message}</span>;
  }

  const updatePosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const tooltipHeight = Math.min(missing.length * 28 + 24, 200);
    const top = rect.bottom + tooltipHeight + 12 <= window.innerHeight
      ? rect.bottom + 8
      : Math.max(8, rect.top - tooltipHeight - 8);
    setPosition({
      left: Math.min(rect.left, window.innerWidth - 240),
      top,
    });
  };
  const cancelScheduledClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };
  const scheduleClose = () => {
    cancelScheduledClose();
    closeTimerRef.current = setTimeout(() => {
      setHovered(false);
      setTooltipHovered(false);
    }, 120);
  };
  const openFromHover = () => {
    cancelScheduledClose();
    updatePosition();
    setHovered(true);
  };
  const closePinned = () => {
    setPinned(false);
    setFocused(false);
    setHovered(false);
    setTooltipHovered(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${missing.length} missing details. Show missing items.`}
        aria-controls={detailsId}
        aria-expanded={open}
        aria-describedby={open ? detailsId : undefined}
        onMouseEnter={openFromHover}
        onMouseLeave={scheduleClose}
        onFocus={() => {
          updatePosition();
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        onClick={() => {
          if (pinned) {
            closePinned();
          } else {
            updatePosition();
            setPinned(true);
            setHovered(false);
            setTooltipHovered(false);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") closePinned();
        }}
        className="relative inline-flex min-h-10 items-center rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 pr-4 text-left text-sm text-foreground outline-none transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="font-medium">{missing.length} Missing details</span>
        <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-card bg-primary text-[10px] font-bold leading-none text-primary-foreground">¡</span>
      </button>
      {open && position ? createPortal(
        <ul
          id={detailsId}
          role="tooltip"
          onMouseEnter={() => {
            cancelScheduledClose();
            setTooltipHovered(true);
          }}
          onMouseLeave={() => {
            setTooltipHovered(false);
            if (!pinned && !focused) scheduleClose();
          }}
          className="fixed z-[200] min-w-52 space-y-1.5 rounded-lg border border-border bg-popover p-3 text-sm text-popover-foreground shadow-lg"
          style={{
            left: `${Math.max(8, position.left)}px`,
            top: `${position.top}px`,
            maxWidth: "min(20rem, calc(100vw - 1rem))",
          }}
        >
          {missing.map((item) => <li key={item}>Missing {item}</li>)}
        </ul>,
        document.body
      ) : null}
    </>
  );
}

function SortableHeader({ id, label, sortKey, dir, onSort }: {
  id: SortKey;
  label: string;
  sortKey: SortKey;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
}) {
  return (
    <th className="px-3 py-1 font-semibold">
      <button type="button" onClick={() => onSort(id)} className="inline-flex min-h-11 items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {label}{sortKey === id ? (dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />) : null}
      </button>
    </th>
  );
}

/**
 * Names are not kept in the saved data, so only the rows on screen are looked up
 * (one request per date shown, remembered for the rest of the session).
 */
export function RecordsTable({ kind, records, missingKey = "", duplicateGroups = [] }: {
  kind: RecordKind;
  records: Rec[];
  missingKey?: MissingKey | "";
  duplicateGroups?: { reasons: string[]; pids: string[] }[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [searchHovered, setSearchHovered] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const debouncedSearch = useDebouncedValue(search.trim());
  const expandedSearchHint = searchHovered || searchFocused;
  const patientSearch = useQuery({
    queryKey: ["rpt-patient-search", debouncedSearch],
    enabled: debouncedSearch.length >= 2,
    staleTime: 60_000,
    queryFn: ({ signal }) => apiRequest<PatientListResponse>(`/patients?${new URLSearchParams({ search: debouncedSearch, page: "1", limit: "100" })}`, { signal }),
  });

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matchedPatients = new Set((patientSearch.data?.patients ?? []).map((patient) => patient.patientId).filter((id): id is string => Boolean(id)));
    const list = q ? records.filter((r) =>
      formatPatientDisplayId(r.pid).toLowerCase().includes(q) || matchedPatients.has(r.pid)
    ) : records;
    const sign = dir === "asc" ? 1 : -1;
    const value = (r: Rec) => (sortKey === "age" ? r.age ?? -1 : sortKey === "area" ? r.area : sortKey === "sex" ? r.sex : sortKey === "pid" ? r.pid : r.date);
    return [...list].sort((a, b) => {
      const x = value(a), y = value(b);
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
      return c !== 0 ? sign * c : a.pid.localeCompare(b.pid);
    });
  }, [records, search, patientSearch.data, sortKey, dir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, totalPages);
  const pageRows = sorted.slice((current - 1) * pageSize, current * pageSize);
  const dates = useMemo(() => [...new Set(pageRows.map((r) => r.date))], [pageRows]);

  const { data: details, isFetching, isError: detailsError } = useQuery({
    queryKey: ["rpt-details", kind, dates.join(",")],
    enabled: dates.length > 0,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const map = new Map<string, ReportRow[]>();
      for (let i = 0; i < dates.length; i += 4) {
        const chunk = dates.slice(i, i + 4);
        const loaded = await Promise.all(chunk.map((d) => loadDayDetails(kind, d, signal)));
        chunk.forEach((d, j) => map.set(d, loaded[j]));
      }
      return map;
    },
  });
  const { data: visitDetails = [], isError: visitDetailsError } = useQuery({
    queryKey: ["rpt-visit-details", dates.join(",")],
    enabled: kind === "visits" && dates.length > 0,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const visits: OPDVisit[] = [];
      for (let i = 0; i < dates.length; i += 4) {
        const chunk = dates.slice(i, i + 4);
        const loaded = await Promise.all(chunk.map((date) => fetchOpdVisitDayDetails(date, signal)));
        loaded.forEach((day) => visits.push(...day));
      }
      return visits;
    },
  });

  const visitCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (kind === "visits") {
      records.forEach((record) => counts.set(record.pid, (counts.get(record.pid) ?? 0) + 1));
    }
    return counts;
  }, [kind, records]);

  const detailRows = useMemo(() => {
    const reportUsage = new Map<string, number>();
    const reportRowsByPatient = new Map<string, ReportRow[]>();
    const visitQueues = new Map<string, OPDVisit[]>();
    details?.forEach((rows, date) => {
      rows.forEach((row) => {
        const key = `${date}|${row.patientId}`;
        const existing = reportRowsByPatient.get(key);
        if (existing) existing.push(row);
        else reportRowsByPatient.set(key, [row]);
      });
    });
    visitDetails.forEach((visit) => {
      const patientId = visit.patient?.patientId;
      if (!patientId) return;
      const key = `${patientId}|${visit.date.slice(0, 10)}|${visit.newReturning ?? ""}`;
      const queue = visitQueues.get(key);
      if (queue) queue.push(visit);
      else visitQueues.set(key, [visit]);
    });
    return pageRows.map((r) => {
      const key = `${r.date}|${r.pid}`;
      const n = reportUsage.get(key) ?? 0;
      reportUsage.set(key, n + 1);
      const candidates = reportRowsByPatient.get(key) ?? [];
      const reportRow = candidates[n] ?? candidates[0] ?? null;
      if (kind !== "visits" || !reportRow) return reportRow;
      const visitKey = `${r.pid}|${r.date}|${"type" in r ? r.type : ""}`;
      const visit = visitQueues.get(visitKey)?.shift();
      return {
        ...reportRow,
        remarks: visit?.remarks ?? null,
        visitRecordedAt: visit?.createdAt ?? null,
      };
    });
  }, [pageRows, details, kind, visitDetails]);

  const sortBy = (key: SortKey) => {
    if (key === sortKey) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setDir(key === "date" ? "desc" : "asc"); }
  };
  const nameOf = (d: ReportRow | null) => d ? formatPatientName(d) || d.name : isFetching ? "…" : "—";
  const dateLabel = (r: Rec) => formatReportDate(r.date);
  const patientDetailFields = (detail: ReportRow | null, area: string): [string, string][] => [
    ["Phone", detail?.phone?.trim() ?? ""],
    ["Email", detail?.email?.trim() ?? ""],
    ["Date of birth", detail?.dateOfBirth ? formatReportDate(detail.dateOfBirth) : ""],
    ["Religion", patientReligionLabel(detail?.religion)],
    ["Occupation", detail?.occupation?.trim() ?? ""],
    ["Region", detail?.region?.trim() ?? ""],
    ["District", detail?.district?.trim() ?? ""],
    ["Town", detail?.town?.trim() ?? ""],
    ["Area", placeLabel(detail?.area?.trim() || area)],
    ["Postal address", detail?.postalAddress?.trim() ?? ""],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  const maritalStatusLabel = (detail: ReportRow | null) => {
    if (!detail) return "—";
    const status = detail.maritalStatus?.trim();
    return status ? status.charAt(0).toUpperCase() + status.slice(1) : "Not recorded";
  };
  const typeLabel = (r: Rec) => ("type" in r ? r.type : "");
  const timeLabel = (r: Rec) => {
    if (!("at" in r) || !r.at) return "";
    const h = hourOf(r.at);
    return h === null ? "" : `${String(h).padStart(2, "0")}:${r.at.slice(14, 16) || "00"}`;
  };
  const dataChecks = (r: Rec, detail: ReportRow | null) => {
    if (kind !== "patients") return null;
    if (!detail) return isFetching ? "Loading patient details…" : detailsError ? "Patient details could not be loaded." : "Patient details are unavailable.";
    const missing: string[] = [];
    if (!detail?.phone?.trim()) missing.push("phone number");
    if (!detail?.dateOfBirth?.trim()) missing.push("date of birth");
    if (!detail?.ghCardNumber?.trim()) missing.push("Ghana Card");
    if (!detail?.nhisNumber?.trim()) missing.push("NHIS number");
    if (!detail?.area?.trim()) missing.push("area");
    const peers = duplicateGroups
      .filter((group) => group.pids.includes(r.pid))
      .flatMap((group) => group.pids.filter((pid) => pid !== r.pid).map((pid) => `${formatPatientDisplayId(pid)} (${group.reasons.join(", ")})`));
    const checks = missingKey === "duplicate" ? peers.length ? `Possible match: ${peers.join("; ")}` : "No other possible match in the loaded records."
      : missingKey ? `Missing ${missingKey === "ghCard" ? "Ghana Card" : missingKey === "nhis" ? "NHIS number" : missingKey === "dob" ? "date of birth" : missingKey === "phone" ? "phone number" : "area"}`
        : missing.length ? `Missing: ${missing.join(", ")}` : "No missing details in these checks";
    return checks;
  };
  const missingDetails = (detail: ReportRow | null) => {
    if (kind !== "patients" || !detail || missingKey === "duplicate") return [];
    const details = [
      ["phone", "phone number", !detail.phone?.trim()],
      ["dob", "date of birth", !detail.dateOfBirth?.trim()],
      ["ghCard", "Ghana Card", !detail.ghCardNumber?.trim()],
      ["nhis", "NHIS number", !detail.nhisNumber?.trim()],
      ["area", "area", !detail.area?.trim()],
    ] as const;
    return details
      .filter(([key, , isMissing]) => isMissing && (!missingKey || key === missingKey))
      .map(([, label]) => label);
  };

  return (
    <div>
      {kind === "visits" && visitDetailsError ? (
        <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          Visit remarks and recorded times could not be loaded. The report rows are still available.
        </p>
      ) : null}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div
          className="w-full min-w-0 sm:w-64 lg:transition-[width] lg:duration-300 lg:ease-out lg:motion-reduce:transition-none lg:hover:w-[40rem] lg:focus-within:w-[40rem]"
          onMouseEnter={() => { if (window.innerWidth >= 1024) setSearchHovered(true); }}
          onMouseLeave={() => setSearchHovered(false)}
        >
          <input
            type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            onFocus={() => { if (window.innerWidth >= 1024) setSearchFocused(true); }}
            onBlur={() => setSearchFocused(false)}
            placeholder={expandedSearchHint
              ? "Search name, phone, DOB/age, OPD No., Ghana Card/NHIS, location, occupation & more..."
              : "Search name, OPD No. & more..."}
            aria-label="Search records by patient name, other name, phone, date of birth, age, OPD number, Ghana Card, NHIS, location, or occupation"
            className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Rows per page
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className={selectClass}>
            {[20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      {patientSearch.isError && debouncedSearch.length >= 2 ? (
        <p className="mb-3 text-sm text-destructive" role="alert">Patient name search is unavailable. You can still search by OPD number.</p>
      ) : null}
      {patientSearch.isFetching && debouncedSearch.length >= 2 ? <p className="mb-3 text-sm text-muted-foreground" role="status">Searching patient names…</p> : null}

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No records match the current period and filters.</div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border">
                <tr>
                  <SortableHeader id="pid" label="OPD No." sortKey={sortKey} dir={dir} onSort={sortBy} />
                  <th className="px-3 py-1 font-semibold">Name</th>
                  {kind === "patients" ? (
                    <>
                      <th className="px-3 py-1 font-semibold">Other name</th>
                      <th className="px-3 py-1 font-semibold">Email</th>
                      <th className="px-3 py-1 font-semibold">Postal address</th>
                      <th className="px-3 py-1 font-semibold">Religion</th>
                      <th className="px-3 py-1 font-semibold">Occupation</th>
                    </>
                  ) : null}
                  <SortableHeader id="age" label="Age" sortKey={sortKey} dir={dir} onSort={sortBy} />
                  <SortableHeader id="sex" label="Sex" sortKey={sortKey} dir={dir} onSort={sortBy} />
                  <th className="px-3 py-1 font-semibold">Marital status</th>
                  <SortableHeader id="area" label="Area" sortKey={sortKey} dir={dir} onSort={sortBy} />
                  <SortableHeader id="date" label={kind === "visits" ? "Visit date" : "Registered"} sortKey={sortKey} dir={dir} onSort={sortBy} />
                  {kind === "visits" ? (
                    <>
                      <th className="px-3 py-1 font-semibold">Type</th>
                      <th className="px-3 py-1 font-semibold">Visit remarks</th>
                      <th className="px-3 py-1 font-semibold">Visit recorded at</th>
                      <th className="px-3 py-1 font-semibold">Visits in report period</th>
                    </>
                  ) : null}
                  {kind === "patients" ? <th className="px-3 py-1 font-semibold">Record checks</th> : null}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                  <tr key={`${r.pid}-${r.date}-${i}`} className="border-b border-border last:border-0">
                    <td className="px-3 py-3 font-mono text-xs">{formatPatientDisplayId(r.pid)}</td>
                    <td className="max-w-64 break-words px-3 py-3">{nameOf(detailRows[i])}</td>
                    {kind === "patients" ? (
                      <>
                        <td className="px-3 py-3">{detailRows[i]?.otherName?.trim() || "—"}</td>
                        <td className="max-w-56 break-words px-3 py-3">{detailRows[i]?.email?.trim() || "—"}</td>
                        <td className="max-w-56 break-words px-3 py-3">{detailRows[i]?.postalAddress?.trim() || "—"}</td>
                        <td className="px-3 py-3">{patientReligionLabel(detailRows[i]?.religion) || "—"}</td>
                        <td className="px-3 py-3">{detailRows[i]?.occupation?.trim() || "—"}</td>
                      </>
                    ) : null}
                    <td className="px-3 py-3 tabular-nums">{r.age ?? "—"}</td>
                    <td className="px-3 py-3 capitalize">{r.sex === "other" ? "—" : r.sex}</td>
                    <td className="px-3 py-3">{maritalStatusLabel(detailRows[i])}</td>
                    <td className="px-3 py-3">{placeLabel(r.area)}</td>
                    <td className="px-3 py-3">{dateLabel(r)} {timeLabel(r)}</td>
                    {kind === "visits" ? (
                      <>
                        <td className="px-3 py-3 capitalize">{typeLabel(r)}</td>
                        <td className="max-w-64 break-words px-3 py-3">{detailRows[i]?.remarks || "—"}</td>
                        <td className="whitespace-nowrap px-3 py-3">{formatReportDateTime(detailRows[i]?.visitRecordedAt)}</td>
                        <td className="px-3 py-3 tabular-nums">{Math.max(1, visitCounts.get(r.pid) ?? 0)}</td>
                      </>
                    ) : null}
                    {kind === "patients" ? (
                      <td className="max-w-72 px-3 py-3 text-muted-foreground">
                        <DesktopRecordChecks
                          patientId={r.pid}
                          message={dataChecks(r, detailRows[i])}
                          missing={missingDetails(detailRows[i])}
                        />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mb-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground md:hidden">
            For a wider, side-by-side view, open this report on a larger screen.
          </p>
          <ul className="space-y-3 md:hidden">
            {pageRows.map((r, i) => (
              <li key={`${r.pid}-${r.date}-${i}`} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {kind === "visits" ? "Patient" : "Registered patient"}
                    </p>
                    <h4 className="mt-1 break-words text-base font-semibold leading-snug text-foreground">{nameOf(detailRows[i])}</h4>
                  </div>
                  <span className="shrink-0 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 font-mono text-xs font-medium text-foreground">
                    <span className="sr-only">OPD No. </span>{formatPatientDisplayId(r.pid)}
                  </span>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border bg-muted/20 px-4 py-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">{kind === "visits" ? "Visit date" : "Registered"}</dt>
                    <dd className="mt-0.5 text-sm font-medium text-foreground">{dateLabel(r)} {timeLabel(r)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Age</dt>
                    <dd className="mt-0.5 text-sm font-medium text-foreground">{r.age === null ? "Not recorded" : `${r.age} years`}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Sex</dt>
                    <dd className="mt-0.5 text-sm font-medium capitalize text-foreground">{r.sex === "other" ? "Not recorded" : r.sex}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Marital status</dt>
                    <dd className="mt-0.5 text-sm font-medium text-foreground">{maritalStatusLabel(detailRows[i])}</dd>
                  </div>
                  {kind === "visits" ? (
                    <div className="col-span-2">
                      <dt className="text-xs text-muted-foreground">Area</dt>
                      <dd className="mt-0.5 break-words text-sm font-medium text-foreground">{placeLabel(r.area)}</dd>
                    </div>
                  ) : null}
                </dl>

                {kind === "patients" && patientDetailFields(detailRows[i], r.area).length ? (
                  <section className="px-4 py-3">
                    <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Additional patient details</h5>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3">
                      {patientDetailFields(detailRows[i], r.area).map(([label, value]) => (
                        <div key={label} className={label === "Postal address" || label === "Email" ? "col-span-2 min-w-0" : "min-w-0"}>
                          <dt className="text-xs text-muted-foreground">{label}</dt>
                          <dd className="mt-0.5 break-words text-sm text-foreground">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ) : null}

                {kind === "visits" ? (
                  <section className="px-4 py-3">
                    <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Visit details</h5>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3">
                      <div className="col-span-2 min-w-0">
                        <dt className="text-xs text-muted-foreground">Remarks</dt>
                        <dd className="mt-0.5 break-words text-sm text-foreground">{detailRows[i]?.remarks || "No visit remarks"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Recorded at</dt>
                        <dd className="mt-0.5 text-sm text-foreground">{formatReportDateTime(detailRows[i]?.visitRecordedAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Visits in report period</dt>
                        <dd className="mt-0.5 text-sm text-foreground">{Math.max(1, visitCounts.get(r.pid) ?? 0)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Visit type</dt>
                        <dd className="mt-0.5 text-sm capitalize text-foreground">{typeLabel(r)}</dd>
                      </div>
                    </dl>
                  </section>
                ) : null}

                {kind === "patients" ? (
                  <div className="border-t border-border px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Record checks</p>
                    <div className="mt-2 break-words text-sm text-foreground">
                      <RecordChecks message={dataChecks(r, detailRows[i])} missing={missingDetails(detailRows[i])} />
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}

      {sorted.length > 0 ? (
        <div className="sticky bottom-0 mt-4 flex items-center justify-between gap-3 border-t border-border bg-card py-2 text-sm text-muted-foreground md:static md:border-0 print:hidden">
          <span>{sorted.length.toLocaleString()} records, page {current} of {totalPages}</span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="min-h-11" disabled={current <= 1} onClick={() => setPage(current - 1)}>Previous</Button>
            <Button type="button" variant="secondary" className="min-h-11" disabled={current >= totalPages} onClick={() => setPage(current + 1)}>Next</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
