"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { WEEKDAYS, WEEKDAYS_SHORT, type Bucket, type Heatmap, type PyramidRow, type Ranked } from "@/lib/reports/analytics";
import type { Sex } from "@/lib/reports/types";

const nf = new Intl.NumberFormat("en-GH");

/** Every chart sits in this frame so it can also be read as a table (accessibility and exact numbers). */
export function ChartFrame({
  title, description, columns, rows, children, className,
}: {
  title: string; description?: string; columns: string[]; rows: (string | number)[][]; children: ReactNode; className?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={cn("min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          aria-pressed={asTable}
          className="-mr-2 inline-flex min-h-11 shrink-0 items-center rounded-md px-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring print:hidden"
        >
          {asTable ? "View chart" : "View as table"}
        </button>
      </div>
      {asTable ? (
        <div className="max-h-96 overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border">
                {columns.map((c) => <th key={c} className="px-3 py-2 font-semibold">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  {r.map((cell, j) => <td key={j} className="px-3 py-2 tabular-nums">{typeof cell === "number" ? nf.format(cell) : cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : children}
    </section>
  );
}

const niceCeil = (v: number) => {
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
};

export function Legend({ items }: { items: { label: string; className: string }[] }) {
  return (
    <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-2"><span className={cn("h-2.5 w-2.5 rounded-sm", i.className)} />{i.label}</span>
      ))}
    </div>
  );
}

export function SplitBar({ newVisits, returning }: { newVisits: number; returning: number }) {
  const total = newVisits + returning;
  return (
    <div>
      <div role="img" aria-label={`${newVisits} new and ${returning} returning visits`} className="mt-4 flex h-3 overflow-hidden rounded-full bg-muted">
        {newVisits > 0 ? <span className="h-full bg-primary" style={{ width: `${(newVisits / total) * 100}%` }} /> : null}
        {returning > 0 ? <span className="h-full bg-accent" style={{ width: `${(returning / total) * 100}%` }} /> : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-foreground">
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-primary" />{nf.format(newVisits)} new</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-accent" />{nf.format(returning)} returning</span>
      </div>
    </div>
  );
}

/** Stacked new/returning bars. The dashed line is the comparison period. Click a bar to zoom into it. */
export function TrendChart({ buckets, ghost, ghostLabel, onPick }: { buckets: Bucket[]; ghost?: number[]; ghostLabel?: string; onPick?: (b: Bucket) => void }) {
  const W = 640, H = 240, L = 38, R = 8, T = 12, B = 28;
  const innerW = W - L - R, innerH = H - T - B;
  const max = niceCeil(Math.max(1, ...buckets.map((b) => b.total), ...(ghost ?? [])));
  const slot = innerW / Math.max(1, buckets.length);
  const barW = Math.max(2, slot * 0.7);
  const y = (v: number) => T + innerH - (v / max) * innerH;
  const step = Math.max(1, Math.ceil(buckets.length / 7));
  const line = ghost && ghost.length > 1
    ? ghost.slice(0, buckets.length).map((v, i) => `${L + i * slot + slot / 2},${y(v)}`).join(" ")
    : null;

  return (
    <>
      <Legend items={[
        { label: "New visits", className: "bg-primary" },
        { label: "Returning visits", className: "bg-accent" },
        ...(line ? [{ label: ghostLabel ?? "Comparison", className: "bg-muted-foreground" }] : []),
      ]} />
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Visits over time. Use View as table for exact numbers.">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} className="stroke-border" strokeWidth={1} />
            <text x={L - 6} y={y(max * f) + 3} textAnchor="end" className="fill-muted-foreground" fontSize={10}>{Math.round(max * f)}</text>
          </g>
        ))}
        {buckets.map((b, i) => {
          const x = L + i * slot + (slot - barW) / 2;
          const hNew = (b.newVisits / max) * innerH;
          const hRet = (b.returning / max) * innerH;
          const hOther = Math.max(0, ((b.total - b.newVisits - b.returning) / max) * innerH);
          return (
            <g key={b.start} onClick={onPick ? () => onPick(b) : undefined} className={onPick ? "cursor-pointer hover:opacity-80" : undefined}>
              <title>{`${b.label}: ${b.total} visits (${b.newVisits} new, ${b.returning} returning)`}</title>
              <rect x={L + i * slot} y={T} width={slot} height={innerH} fill="transparent" />
              <rect x={x} y={y(0) - hNew} width={barW} height={hNew} className="fill-primary" />
              <rect x={x} y={y(0) - hNew - hRet} width={barW} height={hRet} className="fill-accent" />
              {hOther > 0 ? <rect x={x} y={y(0) - hNew - hRet - hOther} width={barW} height={hOther} className="fill-muted-foreground/40" /> : null}
              {i % step === 0 ? <text x={x + barW / 2} y={H - 8} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>{b.label}</text> : null}
            </g>
          );
        })}
        {line ? <polyline points={line} fill="none" className="stroke-muted-foreground" strokeWidth={1.5} strokeDasharray="4 3" /> : null}
      </svg>
    </>
  );
}

/** Age and sex as two-sided bars. Click a bar to filter the whole report to that group. */
export function Pyramid({ rows, active, onPick }: { rows: PyramidRow[]; active: { sex: Sex | ""; band: string }; onPick: (sex: Sex, band: string) => void }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.male, r.female]));
  return (
    <>
      <Legend items={[{ label: "Male", className: "bg-foreground/70" }, { label: "Female", className: "bg-foreground/25" }]} />
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.band} className="grid grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1fr)] items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => onPick("male", r.band)}
              aria-label={`Male, age ${r.band}: ${r.male} visits. Filter to this group`}
              className="flex min-h-7 items-center justify-end gap-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="tabular-nums text-muted-foreground">{r.male}</span>
              <span className={cn("h-4 rounded-l bg-foreground/70", active.sex === "male" && active.band === r.band && "ring-2 ring-primary")} style={{ width: `${(r.male / max) * 100}%`, minWidth: r.male ? 2 : 0 }} />
            </button>
            <span className="text-center font-medium text-foreground">{r.band}</span>
            <button
              type="button"
              onClick={() => onPick("female", r.band)}
              aria-label={`Female, age ${r.band}: ${r.female} visits. Filter to this group`}
              className="flex min-h-7 items-center gap-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className={cn("h-4 rounded-r bg-foreground/25", active.sex === "female" && active.band === r.band && "ring-2 ring-primary")} style={{ width: `${(r.female / max) * 100}%`, minWidth: r.female ? 2 : 0 }} />
              <span className="tabular-nums text-muted-foreground">{r.female}</span>
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

export function RankedBars({ rows, onPick, active }: { rows: Ranked[]; onPick?: (name: string) => void; active?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nothing to show for this selection.</p>;
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => {
        const clickable = onPick && r.name !== "Other places" && r.name !== "Not recorded";
        const inner = (
          <>
            <span className="absolute inset-y-0 left-0 rounded bg-foreground/10" style={{ width: `${(r.count / max) * 100}%` }} aria-hidden="true" />
            <span className="relative flex w-full items-center justify-between gap-3 px-2 text-sm">
              <span className="min-w-0 break-words text-left text-foreground">{r.name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{nf.format(r.count)} ({Math.round(r.share * 100)}%)</span>
            </span>
          </>
        );
        const base = "relative flex min-h-10 w-full items-center overflow-hidden rounded";
        return (
          <li key={r.name}>
            {clickable ? (
              <button type="button" onClick={() => onPick(r.name)} className={cn(base, "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active === r.name && "ring-2 ring-primary")}>{inner}</button>
            ) : <div className={base}>{inner}</div>}
          </li>
        );
      })}
    </ul>
  );
}

/** Weekday by hour. Darker means busier. Click a weekday name to filter to it. */
export function HeatmapGrid({ heat, activeWeekday, onPickWeekday }: { heat: Heatmap; activeWeekday: number | null; onPickWeekday: (day: number) => void }) {
  const hours = Array.from({ length: heat.maxHour - heat.minHour + 1 }, (_, i) => heat.minHour + i);
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[34rem] gap-1" style={{ gridTemplateColumns: `3.5rem repeat(${hours.length}, minmax(1.25rem, 1fr))` }} role="table" aria-label="Visits by weekday and hour">
        <span />
        {hours.map((h) => <span key={h} className="text-center text-[10px] text-muted-foreground">{h % 2 === 0 ? h : ""}</span>)}
        {WEEKDAYS.map((day, d) => (
          <div key={day} className="contents" role="row">
            <button type="button" onClick={() => onPickWeekday(d)} className={cn("min-h-8 rounded text-left text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", activeWeekday === d && "ring-2 ring-primary")}>
              {WEEKDAYS_SHORT[d]}
            </button>
            {hours.map((h) => {
              const n = heat.grid[d][h];
              return (
                <div key={h} role="cell" title={`${day} ${h}:00, ${n} visits`} aria-label={`${day} ${h}:00, ${n} visits`}
                  className={cn("h-8 rounded-sm", n === 0 ? "bg-muted" : "bg-primary")}
                  style={n === 0 ? undefined : { opacity: 0.12 + 0.88 * (n / Math.max(1, heat.max)) }} />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
