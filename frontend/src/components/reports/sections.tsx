"use client";

import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  RETENTION_WINDOWS, WEEKDAYS, describeDelta,
  type Bucket, type Heatmap, type LapsedPatient, type PyramidRow, type Quality, type Ranked, type Summary, type UnusualDay,
} from "@/lib/reports/analytics";
import type { findDuplicates, buildRetention } from "@/lib/reports/analytics";
import { formatPatientDisplayId } from "@/lib/reporting";
import type { MaritalStatus, RecordKind, Sex, Slice } from "@/lib/reports/types";
import { ChartFrame, HeatmapGrid, Pyramid, RankedBars, SplitBar, TrendChart } from "./charts";

const nf = new Intl.NumberFormat("en-GH");

export type ReportModel = {
  summary: Summary; prev: Summary | null; prevLabel: string;
  trend: Bucket[]; ghost?: number[];
  insights: string[]; unusual: UnusualDay[];
  pyramid: PyramidRow[]; areas: Ranked[]; towns: Ranked[];
  marital: { status: MaritalStatus; name: string; count: number; share: number }[];
  quality: Quality; duplicates: ReturnType<typeof findDuplicates>;
  heat: Heatmap; weekday: { totals: number[]; typical: number[] };
  frequency: { label: string; patients: number }[];
  history: { loading: boolean; failed: boolean; retention: ReturnType<typeof buildRetention>; lapsed: LapsedPatient[] } | null;
  slice: Slice;
  actions: {
    setSlice: (next: Slice) => void;
    zoomTo: (bucket: Bucket) => void;
    openRecords: (kind: RecordKind, slice: Partial<Slice>) => void;
    buildHistory: () => void;
    exportLapsed: () => void;
  };
};

function Note({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{children}</p>;
}

function LedgerLine({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      </div>
      <p className="shrink-0 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function OverviewSection({ m }: { m: ReportModel }) {
  const { summary: s, prev } = m;
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:divide-x lg:divide-border">
          <div className="min-w-0 p-5 sm:p-6">
            <p className="text-sm font-medium text-muted-foreground">OPD visits</p>
            <p className="mt-2 text-5xl font-semibold tabular-nums tracking-tight text-foreground sm:text-6xl">{nf.format(s.visits)}</p>
            <SplitBar newVisits={s.newVisits} returning={s.returning} />
            {prev ? <p className="mt-4 text-sm text-muted-foreground">{describeDelta(s.visits, prev.visits, m.prevLabel)}</p> : null}
          </div>
          <div className="min-w-0 divide-y divide-border border-t border-border p-5 sm:p-6 lg:border-t-0">
            <LedgerLine label="Unique patients" value={nf.format(s.unique)} note={prev ? describeDelta(s.unique, prev.unique, m.prevLabel) : null} />
            <LedgerLine label="New patient records" value={nf.format(s.registrations)} note={prev ? describeDelta(s.registrations, prev.registrations, m.prevLabel) : "Registered in this period"} />
            <LedgerLine label="Average visits per day" value={s.perDay.toLocaleString("en-GH", { maximumFractionDigits: 1 })} note={prev ? `${m.prevLabel}: ${prev.perDay.toLocaleString("en-GH", { maximumFractionDigits: 1 })}` : null} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5" aria-labelledby="notes-heading">
        <h3 id="notes-heading" className="text-lg font-semibold text-foreground">What stands out</h3>
        <ul className="mt-3 space-y-2 text-sm text-foreground">
          {m.insights.map((line) => <li key={line} className="flex gap-2"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/40" />{line}</li>)}
        </ul>
      </section>

      <ChartFrame
        title="Visits over time"
        description="Click a bar to zoom into that day, week or month."
        columns={["Period", "New", "Returning", "Total"]}
        rows={m.trend.map((b) => [b.label, b.newVisits, b.returning, b.total])}
      >
        <TrendChart buckets={m.trend} ghost={m.ghost} ghostLabel={m.prevLabel} onPick={m.actions.zoomTo} />
      </ChartFrame>

      {m.unusual.length > 0 ? (
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <h3 className="text-lg font-semibold text-foreground">Unusual days</h3>
          <p className="mt-1 text-sm text-muted-foreground">Compared with the usual count for the same weekday in this period.</p>
          <ul className="mt-3 divide-y divide-border">
            {m.unusual.map((d) => (
              <li key={d.date} className="flex flex-wrap items-center justify-between gap-x-4 py-3 text-sm">
                <span className="font-medium text-foreground">{format(parseISO(d.date), "EEEE, d MMM yyyy")}</span>
                <span className="text-muted-foreground">
                  {d.count} visits, usually about {Math.round(d.typical)}.{" "}
                  {d.kind === "quiet" ? (d.count === 0 ? "Nothing recorded. Holiday or missing entries?" : "Unusually quiet.") : "Unusually busy."}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function PeopleSection({ m }: { m: ReportModel }) {
  const { slice, actions } = m;
  const nhis = m.quality.fields.find((f) => f.key === "nhis");
  const ghCard = m.quality.fields.find((f) => f.key === "ghCard");
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <ChartFrame
          title="Age and sex"
          description="Click a bar to filter the whole report to that group."
          columns={["Age group", "Male", "Female", "Other or unknown", "Total"]}
          rows={m.pyramid.map((r) => [r.band, r.male, r.female, r.other, r.male + r.female + r.other])}
        >
          <Pyramid
            rows={m.pyramid}
            active={{ sex: slice.sex, band: slice.ageBand }}
            onPick={(sex: Sex, band: string) => actions.setSlice(slice.sex === sex && slice.ageBand === band ? { ...slice, sex: "", ageBand: "" } : { ...slice, sex, ageBand: band })}
          />
        </ChartFrame>

        <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <h3 className="text-lg font-semibold text-foreground">Insurance and ID coverage</h3>
          <p className="mt-1 text-sm text-muted-foreground">Among the {nf.format(m.quality.total)} new patient records in this period.</p>
          {m.quality.total === 0 ? <div className="mt-4"><Note>No new patient records in this period.</Note></div> : (
            <div className="mt-4 space-y-5">
              {[{ label: "NHIS number recorded", f: nhis }, { label: "Ghana Card recorded", f: ghCard }].map(({ label, f }) => f ? (
                <div key={label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-2xl font-semibold tabular-nums">{100 - f.pct}%</p>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${100 - f.pct}% recorded`}>
                    <div className="h-full bg-primary" style={{ width: `${100 - f.pct}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{nf.format(f.missing)} without</p>
                </div>
              ) : null)}
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartFrame title="Where patients come from: areas" description="Click an area to filter." columns={["Area", "Visits", "Share"]} rows={m.areas.map((a) => [a.name, a.count, `${Math.round(a.share * 100)}%`])}>
          <RankedBars rows={m.areas} active={slice.area} onPick={(name) => actions.setSlice({ ...slice, area: slice.area === name ? "" : name })} />
        </ChartFrame>
        <ChartFrame title="Towns" description="Based on the town on each linked patient profile. Visits without a town recorded are shown as Not recorded. Click a town to filter." columns={["Town", "Visits", "Share"]} rows={m.towns.map((a) => [a.name, a.count, `${Math.round(a.share * 100)}%`])}>
          <RankedBars rows={m.towns} active={slice.town} onPick={(name) => actions.setSlice({ ...slice, town: slice.town === name ? "" : name })} />
        </ChartFrame>
      </div>

      <ChartFrame
        title="Marital status"
        description="Patient registrations matching the other filters. Click a status to filter the report."
        columns={["Status", "Patients", "Share"]}
        rows={m.marital.map((row) => [row.name, row.count, `${Math.round(row.share * 100)}%`])}
      >
        {m.marital.length === 0 ? <Note>No patient registrations match the other filters.</Note> : (
          <RankedBars
            rows={m.marital}
            active={m.marital.find((row) => row.status === slice.maritalStatus)?.name ?? ""}
            onPick={(name) => {
              const status = m.marital.find((row) => row.name === name)?.status;
              if (status && status !== "unknown") {
                actions.setSlice({ ...slice, maritalStatus: slice.maritalStatus === status ? "" : status });
              }
            }}
          />
        )}
      </ChartFrame>

    </div>
  );
}

export function BusySection({ m }: { m: ReportModel }) {
  const { heat, slice, actions } = m;
  return (
    <div className="space-y-6">
      <ChartFrame
        title="Busy hours"
        description="Darker means busier. Click a weekday to filter."
        columns={["Weekday", ...Array.from({ length: heat.maxHour - heat.minHour + 1 }, (_, i) => `${heat.minHour + i}:00`)]}
        rows={WEEKDAYS.map((day, d) => [day, ...Array.from({ length: heat.maxHour - heat.minHour + 1 }, (_, i) => heat.grid[d][heat.minHour + i])])}
      >
        {heat.withHour === 0 ? <Note>Visit times are not available for this selection, so the hourly view cannot be drawn.</Note> : (
          <>
            {heat.withHour < heat.total ? <div className="mb-3"><Note>Times are known for {nf.format(heat.withHour)} of {nf.format(heat.total)} visits.</Note></div> : null}
            <HeatmapGrid heat={heat} activeWeekday={slice.weekday} onPickWeekday={(d) => actions.setSlice({ ...slice, weekday: slice.weekday === d ? null : d })} />
          </>
        )}
      </ChartFrame>

    </div>
  );
}

export function ReturningSection({ m }: { m: ReportModel }) {
  const max = Math.max(1, ...m.frequency.map((f) => f.patients));
  const h = m.history;
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <h3 className="text-lg font-semibold text-foreground">How often patients came</h3>
        <p className="mt-1 text-sm text-muted-foreground">Number of patients by how many times they were seen in this period.</p>
        <ul className="mt-4 space-y-2">
          {m.frequency.map((f) => (
            <li key={f.label} className="relative flex min-h-10 items-center overflow-hidden rounded">
              <span className="absolute inset-y-0 left-0 rounded bg-foreground/10" style={{ width: `${(f.patients / max) * 100}%` }} aria-hidden="true" />
              <span className="relative flex w-full justify-between gap-3 px-2 text-sm"><span>{f.label}</span><span className="tabular-nums text-muted-foreground">{nf.format(f.patients)} patients</span></span>
            </li>
          ))}
        </ul>
      </section>

      {!h ? (
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-foreground">Retention and lapsed patients</h3>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            This analysis uses all visit history available to your account, not just the selected report period. It groups patients by their earliest recorded visit and measures whether they returned within 30, 90, or 180 days. Patients with at least two recorded visits and no visit in the last 90 days are listed as lapsed. Results may be incomplete if older visits are missing. Build the history once to calculate these measures.
          </p>
          <Button type="button" className="mt-4 min-h-11" onClick={m.actions.buildHistory}>Build visit history</Button>
        </section>
      ) : h.loading ? (
        <Note>Building visit history. Progress is shown at the top of the page.</Note>
      ) : h.failed ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">Could not build the visit history. Try again from the refresh button.</div>
      ) : (
        <>
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <h3 className="text-lg font-semibold text-foreground">Did they come back?</h3>
            <p className="mt-1 text-sm text-muted-foreground">Patients are grouped by the month of their earliest visit on record. Each percentage is the share with a later recorded visit within 30, 90, or 180 days. A dash means the full follow-up window has not elapsed. Missing historical visits can affect these results.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead><tr className="border-b border-border"><th className="px-3 py-2 font-semibold">First visit month</th><th className="px-3 py-2 font-semibold">Patients</th>{RETENTION_WINDOWS.map((d) => <th key={d} className="px-3 py-2 font-semibold">Back within {d} days</th>)}</tr></thead>
                <tbody>
                  {h.retention.map((row) => (
                    <tr key={row.month} className="border-b border-border last:border-0">
                      <td className="px-3 py-3">{format(parseISO(`${row.month}-01`), "MMM yyyy")}</td>
                      <td className="px-3 py-3 tabular-nums">{nf.format(row.size)}</td>
                      {row.cells.map((c, i) => <td key={i} className="px-3 py-3 tabular-nums">{c.eligible === row.size && row.size > 0 ? `${Math.round((c.returned / c.eligible) * 100)}%` : "—"}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Lapsed patients</h3>
                <p className="mt-1 text-sm text-muted-foreground">At least two recorded visits, with no visit recorded in the last 90 days. {nf.format(h.lapsed.length)} patients. This list may include patients whose older visits are not in the system.</p>
              </div>
              <Button type="button" variant="secondary" className="min-h-11" onClick={m.actions.exportLapsed} disabled={h.lapsed.length === 0}>Download list (CSV)</Button>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead><tr className="border-b border-border"><th className="px-3 py-2 font-semibold">OPD No.</th><th className="px-3 py-2 font-semibold">Visits</th><th className="px-3 py-2 font-semibold">Last seen</th><th className="px-3 py-2 font-semibold">Days ago</th><th className="px-3 py-2 font-semibold">Age</th><th className="px-3 py-2 font-semibold">Area</th></tr></thead>
                <tbody>
                  {h.lapsed.slice(0, 50).map((p) => (
                    <tr key={p.pid} className="border-b border-border last:border-0">
                      <td className="px-3 py-3 font-mono text-xs">{formatPatientDisplayId(p.pid)}</td>
                      <td className="px-3 py-3 tabular-nums">{p.visits}</td>
                      <td className="px-3 py-3">{format(parseISO(p.lastDate), "d MMM yyyy")}</td>
                      <td className="px-3 py-3 tabular-nums">{p.daysSince}</td>
                      <td className="px-3 py-3 tabular-nums">{p.age ?? "—"}</td>
                      <td className="px-3 py-3">{p.area || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {h.lapsed.length > 50 ? <p className="mt-3 text-xs text-muted-foreground">Showing the 50 most recent. The CSV has all of them.</p> : null}
          </section>
        </>
      )}
    </div>
  );
}

export function QualitySection({ m }: { m: ReportModel }) {
  const { quality, duplicates, actions } = m;
  if (quality.total === 0) return <Note>No new patient records in this period.</Note>;
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <h3 className="text-lg font-semibold text-foreground">Missing information</h3>
        <p className="mt-1 text-sm text-muted-foreground">Among {nf.format(quality.total)} patients registered in this period. Open a list to fix the records.</p>
        <ul className="mt-4 divide-y divide-border">
          {quality.fields.map((f) => (
            <li key={f.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <div className="min-w-40 flex-1">
                <div className="flex justify-between gap-3 text-sm"><span className="font-medium text-foreground">{f.label}</span><span className="tabular-nums text-muted-foreground">{nf.format(f.missing)} missing ({f.pct}%)</span></div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${f.pct}% missing`}><div className="h-full bg-foreground/50" style={{ width: `${f.pct}%` }} /></div>
              </div>
              <Button type="button" variant="secondary" className="min-h-11" disabled={f.missing === 0} onClick={() => actions.openRecords("patients", { missing: f.key })}>Show list</Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Possible duplicates</h3>
            <p className="mt-1 text-sm text-muted-foreground">Possible matches are identified from records in this period that share a name and date of birth or a phone number. This is a review aid, not proof of duplication; check patient details before taking action.</p>
          </div>
          <Button type="button" variant="secondary" className="min-h-11" disabled={duplicates.pids.size === 0} onClick={() => actions.openRecords("patients", { missing: "duplicate" })}>Show list</Button>
        </div>
        <div className="mt-3">
          {duplicates.groups.length === 0 ? <Note>No possible duplicates found among the records loaded.</Note> : (
            <ul className="divide-y divide-border">
              {duplicates.groups.slice(0, 10).map((g, i) => (
                <li key={i} className="py-3 text-sm">
                  <p className="text-muted-foreground">{g.reasons.join(" and ")}</p>
                  <p className="mt-1 font-mono text-xs text-foreground">{g.pids.map(formatPatientDisplayId).join(", ")}</p>
                </li>
              ))}
            </ul>
          )}
          {duplicates.groups.length > 10 ? <p className="mt-3 text-xs text-muted-foreground">{duplicates.groups.length - 10} more groups. Use Show list for all of them.</p> : null}
        </div>
      </section>
    </div>
  );
}
