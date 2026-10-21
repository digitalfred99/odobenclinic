import { formatPatientDisplayId, formatReportDate, formatReportDateTime } from "@/lib/reporting";
import type { ReportRow } from "@/types/report";
import { WEEKDAYS, type Bucket, type Heatmap, type PyramidRow, type Quality, type Ranked, type Summary } from "./analytics";
import type { RecordKind } from "./types";

/** Change this to your facility's name. */
export const FACILITY_NAME = "ODOBEN HEALTH CENTER";

type RGB = [number, number, number];

function readColorToken(token: string): RGB {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const hex = value.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (hex) {
    const digits = hex[1].length === 3
      ? [...hex[1]].map((digit) => `${digit}${digit}`).join("")
      : hex[1];
    return [0, 2, 4].map((index) => Number.parseInt(digits.slice(index, index + 2), 16)) as RGB;
  }

  const rgb = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    const channels = rgb.slice(1, 4).map(Number);
    if (channels.every((channel) => channel >= 0 && channel <= 255)) return channels as RGB;
  }

  throw new Error(`Could not read the ${token} design token for report export.`);
}

function getExportPalette() {
  return {
    primary: readColorToken("--primary"),
    primaryForeground: readColorToken("--primary-foreground"),
    foreground: readColorToken("--foreground"),
    mutedForeground: readColorToken("--muted-foreground"),
    muted: readColorToken("--muted"),
    secondary: readColorToken("--secondary"),
    accent: readColorToken("--accent"),
    border: readColorToken("--border"),
  };
}

function toArgb([red, green, blue]: RGB): string {
  return `FF${[red, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

export type ReportField =
  | "patientId" | "firstName" | "otherName" | "lastName" | "name" | "dateOfBirth" | "age" | "phone" | "region" | "district"
  | "town" | "gender" | "maritalStatus" | "area" | "ghCardNumber" | "nhisNumber" | "date" | "dateRegistered"
  | "newReturning" | "visitRecordedAt" | "visitsInReport" | "remarks";
export type ReportFieldOption = { key: ReportField; label: string };

export function getReportFields(kind: RecordKind): ReportFieldOption[] {
  if (kind === "patients") {
    return [
      { key: "patientId", label: "Patient ID / OPD No." }, { key: "firstName", label: "First name" },
      { key: "otherName", label: "Other name" }, { key: "lastName", label: "Last name" }, { key: "name", label: "Full name" },
      { key: "dateOfBirth", label: "Date of birth" }, { key: "age", label: "Age" },
      { key: "phone", label: "Phone" }, { key: "gender", label: "Gender" },
      { key: "maritalStatus", label: "Marital status" }, { key: "ghCardNumber", label: "Ghana Card number" },
      { key: "nhisNumber", label: "NHIS number" }, { key: "region", label: "Region" },
      { key: "district", label: "District" }, { key: "town", label: "Town" },
      { key: "area", label: "Area" }, { key: "dateRegistered", label: "Date registered" },
    ];
  }
  return [
    { key: "patientId", label: "OPD No." }, { key: "name", label: "Name" }, { key: "age", label: "Age" },
    { key: "gender", label: "Gender" }, { key: "maritalStatus", label: "Marital status" }, { key: "area", label: "Area" }, { key: "date", label: "Visit date" },
    { key: "visitRecordedAt", label: "Visit recorded at" }, { key: "visitsInReport", label: "Visits in report period" },
    { key: "newReturning", label: "New/Returning" }, { key: "remarks", label: "Visit remarks" },
  ];
}

export const PERSONAL_FIELDS: ReportField[] = ["firstName", "otherName", "lastName", "name", "dateOfBirth", "phone", "ghCardNumber", "nhisNumber"];

function rawValue(row: ReportRow, kind: RecordKind, field: ReportField): string | number | boolean | null {
  switch (field) {
    case "patientId": return formatPatientDisplayId(row.patientId);
    case "date": return kind === "patients" ? (row.dateRegistered ?? row.date ?? null) : row.date ?? null;
    default: return (row[field as keyof ReportRow] as string | number | boolean | null | undefined) ?? null;
  }
}

export function formatCell(value: string | number | boolean | null | undefined) {
  return value == null || (typeof value === "string" && value.trim() === "") ? "—" : value;
}

export function fieldValue(row: ReportRow, kind: RecordKind, field: ReportField) {
  const value = rawValue(row, kind, field);
  if ((field === "date" || field === "dateOfBirth" || field === "dateRegistered") && typeof value === "string") return formatReportDate(value);
  if (field === "visitRecordedAt" && typeof value === "string") return formatReportDateTime(value);
  return value;
}

export function addVisitCounts(rows: ReportRow[]): ReportRow[] {
  const counts = new Map<string, number>();
  rows.forEach((r) => counts.set(r.patientId, (counts.get(r.patientId) ?? 0) + 1));
  return rows.map((r) => ({ ...r, visitsInReport: counts.get(r.patientId) ?? 0 }));
}

/* ---------- downloads ---------- */

export function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Stops a name or remark such as "=HYPERLINK(...)" from running as a formula when a CSV is opened in Excel.
 * Plain negative numbers are left alone. (Cells in .xlsx files are stored as text, so they are already inert.)
 */
export function csvSafe(value: string | number | boolean): string {
  const s = String(value);
  return /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
}

export type CsvReportMetadata = {
  title: string;
  subtitle?: string;
  generatedAt?: string;
};

export async function exportCsv(
  headers: string[],
  rows: (string | number | boolean)[][],
  filename: string,
  metadata: CsvReportMetadata = { title: "Clinic report" },
) {
  const { serializeCsv } = await import("@/lib/export/csv");
  const body = [headers, ...rows].map((row) => row.map(csvSafe));
  const generatedAt = metadata.generatedAt ?? new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short" }).format(new Date());
  const brandedRows = [
    [FACILITY_NAME],
    [metadata.title],
    ...(metadata.subtitle ? [[metadata.subtitle]] : []),
    ["Generated", generatedAt],
    [],
    ...body,
  ];
  downloadFile(new Blob([`\uFEFF${serializeCsv(brandedRows)}`], { type: "text/csv;charset=utf-8" }), filename);
}

export async function exportRecordsPdf(opts: {
  title: string; subtitle: string; headers: string[]; rows: (string | number | boolean)[][]; filename: string;
}) {
  const { jsPDF } = await import("jspdf");
  const { autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape" });
  const palette = getExportPalette();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setTextColor(...palette.primary);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(FACILITY_NAME, 14, 11);
  doc.setTextColor(...palette.foreground);
  doc.setFontSize(15);
  doc.text(opts.title, 14, 19);
  doc.setTextColor(...palette.mutedForeground);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(opts.subtitle, 14, 26);
  doc.setDrawColor(...palette.primary);
  doc.setLineWidth(0.8);
  doc.line(14, 30, pageWidth - 14, 30);
  autoTable(doc, {
    head: [opts.headers], body: opts.rows.map((r) => r.map(String)), startY: 34,
    styles: { overflow: "linebreak", cellPadding: 2.5, textColor: palette.foreground, lineColor: palette.border, lineWidth: 0.15 },
    headStyles: { fillColor: palette.primary, textColor: palette.primaryForeground, fontStyle: "bold", minCellHeight: 8 },
    alternateRowStyles: { fillColor: palette.muted },
    horizontalPageBreak: true,
    didDrawPage: () => {
      doc.setTextColor(...palette.mutedForeground);
      doc.setFontSize(8);
      doc.text(`${FACILITY_NAME}  ·  Page ${doc.getNumberOfPages()}`, pageWidth - 14, pageHeight - 7, { align: "right" });
    },
  });
  doc.save(opts.filename);
}

/* ---------- the summary workbook and the one-page brief ---------- */

export type ExportContext = {
  facility: string; periodLabel: string; filterSummary: string; generatedAt: string;
  summary: Summary; prev: Summary | null; prevLabel: string;
  trend: Bucket[]; ghost?: number[];
  pyramid: PyramidRow[]; areas: Ranked[]; heat: Heatmap;
  weekday: { totals: number[]; typical: number[] };
  insights: string[]; quality: Quality | null;
};

export async function exportWorkbook(ctx: ExportContext, records: { name: string; headers: string[]; rows: (string | number | boolean)[][] } | null, filename: string) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const palette = getExportPalette();
  const brandFill = toArgb(palette.primary);
  const brandText = toArgb(palette.primaryForeground);
  const mutedFill = toArgb(palette.muted);
  const borderColor = toArgb(palette.border);

  const sum = wb.addWorksheet("Summary");
  sum.columns = [{ width: 34 }, { width: 18 }, { width: 18 }];
  sum.addRow([ctx.facility]);
  sum.mergeCells("A1:C1");
  sum.getRow(1).font = { bold: true, size: 16, color: { argb: brandText } };
  sum.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: brandFill } };
  sum.getRow(1).height = 30;
  sum.addRow(["Period", ctx.periodLabel]);
  sum.addRow(["Filters", ctx.filterSummary]);
  sum.addRow(["Generated", ctx.generatedAt]);
  sum.addRow([]);
  const head = sum.addRow(["Measure", "This period", ctx.prev ? ctx.prevLabel : ""]);
  const styleHeader = (row: ReturnType<typeof sum.getRow>) => {
    row.font = { bold: true, color: { argb: brandText } };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: brandFill } };
    row.alignment = { vertical: "middle", wrapText: true };
    row.height = 24;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = { bottom: { style: "thin", color: { argb: borderColor } } };
    });
  };
  styleHeader(head);
  const line = (label: string, a: number, b?: number) => sum.addRow([label, a, b ?? ""]);
  line("OPD visits", ctx.summary.visits, ctx.prev?.visits);
  line("Unique patients", ctx.summary.unique, ctx.prev?.unique);
  line("New patient records", ctx.summary.registrations, ctx.prev?.registrations);
  line("New visits", ctx.summary.newVisits, ctx.prev?.newVisits);
  line("Returning visits", ctx.summary.returning, ctx.prev?.returning);
  line("Average visits per day", Math.round(ctx.summary.perDay * 10) / 10, ctx.prev ? Math.round(ctx.prev.perDay * 10) / 10 : undefined);
  if (ctx.insights.length) {
    sum.addRow([]);
    const notesHeader = sum.addRow(["Notes"]);
    styleHeader(notesHeader);
    ctx.insights.forEach((t) => sum.addRow([t]));
  }

  const styleTable = (ws: ReturnType<typeof wb.addWorksheet>) => {
    styleHeader(ws.getRow(1));
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber > 1 && rowNumber % 2 === 0) {
        row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: mutedFill } };
      }
      if (rowNumber > 1) row.alignment = { vertical: "middle", wrapText: true };
    });
  };

  const trend = wb.addWorksheet("Trend");
  trend.columns = [{ header: "Period start", width: 14 }, { header: "Period end", width: 14 }, { header: "New", width: 10 }, { header: "Returning", width: 12 }, { header: "Total", width: 10 }];
  ctx.trend.forEach((b) => trend.addRow([b.start, b.end, b.newVisits, b.returning, b.total]));
  styleTable(trend);

  const areas = wb.addWorksheet("By area");
  areas.columns = [{ header: "Area", width: 28 }, { header: "Visits", width: 10 }, { header: "Share", width: 10 }];
  ctx.areas.forEach((a) => areas.addRow([a.name, a.count, `${Math.round(a.share * 100)}%`]));
  styleTable(areas);

  const age = wb.addWorksheet("Age and sex");
  age.columns = [{ header: "Age band", width: 12 }, { header: "Male", width: 10 }, { header: "Female", width: 10 }, { header: "Other/unknown", width: 16 }, { header: "Total", width: 10 }];
  ctx.pyramid.forEach((r) => age.addRow([r.band, r.male, r.female, r.other, r.male + r.female + r.other]));
  styleTable(age);

  const heat = wb.addWorksheet("Weekday and hour");
  const hours = Array.from({ length: ctx.heat.maxHour - ctx.heat.minHour + 1 }, (_, i) => ctx.heat.minHour + i);
  heat.addRow(["Weekday", ...hours.map((h) => `${h}:00`), "All day", "Typical day"]);
  WEEKDAYS.forEach((day, d) => heat.addRow([day, ...hours.map((h) => ctx.heat.grid[d][h]), ctx.weekday.totals[d], Math.round(ctx.weekday.typical[d])]));
  styleTable(heat);

  if (ctx.quality) {
    const q = wb.addWorksheet("Data quality");
    q.columns = [{ header: "Field", width: 22 }, { header: "Missing", width: 10 }, { header: "Percent", width: 10 }];
    ctx.quality.fields.forEach((f) => q.addRow([f.label, f.missing, `${f.pct}%`]));
    styleTable(q);
  }
  if (records) {
    const data = wb.addWorksheet(records.name.slice(0, 31));
    data.columns = records.headers.map((header, i) => ({
      header, width: Math.min(Math.max(12, header.length, ...records.rows.slice(0, 200).map((r) => String(r[i] ?? "").length)) + 2, 40),
    }));
    records.rows.forEach((r) => data.addRow(r));
    styleTable(data);
  }
  const buffer = await wb.xlsx.writeBuffer();
  downloadFile(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
}

/** One landscape A4 page for the chief: headline numbers, trend, age and sex, areas, busy times, notes, signatures. */
export async function exportBrief(ctx: ExportContext, filename: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const palette = getExportPalette();
  const M = 12;
  const ink = palette.foreground;
  const muted = palette.mutedForeground;
  const brand = palette.primary;
  const soft = palette.secondary;
  const male = palette.primary;
  const female = palette.accent;

  const text = (s: string, x: number, y: number, size = 9, color: RGB = ink, weight: "normal" | "bold" = "normal", align: "left" | "right" | "center" = "left") => {
    doc.setFont("helvetica", weight); doc.setFontSize(size); doc.setTextColor(...color); doc.text(s, x, y, { align });
  };
  const rect = (x: number, y: number, w: number, h: number, color: RGB) => { doc.setFillColor(...color); doc.rect(x, y, Math.max(w, 0), Math.max(h, 0), "F"); };
  const delta = (cur: number, prev?: number) => (prev === undefined ? "" : cur === prev ? "same as before" : `${Math.abs(cur - prev).toLocaleString()} ${cur > prev ? "more" : "fewer"} than ${ctx.prevLabel}`);

  text(ctx.facility, M, 12, 10, ink, "bold");
  text("OPD summary", M, 20, 17, ink, "bold");
  text(`${ctx.periodLabel}${ctx.filterSummary ? `  |  ${ctx.filterSummary}` : ""}`, M, 26, 9, muted);
  text(`Generated ${ctx.generatedAt}`, 285, 12, 8, muted, "normal", "right");
  doc.setDrawColor(...brand);
  doc.setLineWidth(1);
  doc.line(M, 29, 285, 29);

  const kpis: [string, string, string][] = [
    ["OPD visits", ctx.summary.visits.toLocaleString(), delta(ctx.summary.visits, ctx.prev?.visits)],
    ["Unique patients", ctx.summary.unique.toLocaleString(), delta(ctx.summary.unique, ctx.prev?.unique)],
    ["New patient records", ctx.summary.registrations.toLocaleString(), delta(ctx.summary.registrations, ctx.prev?.registrations)],
    ["Average per day", (Math.round(ctx.summary.perDay * 10) / 10).toLocaleString(), `${ctx.summary.newVisits.toLocaleString()} new, ${ctx.summary.returning.toLocaleString()} returning`],
  ];
  kpis.forEach(([label, value, note], i) => {
    const x = M + i * 68.5;
    doc.setDrawColor(...soft); doc.line(x, 31, x + 62, 31);
    text(label, x, 36, 8, muted);
    text(value, x, 46, 20, ink, "bold");
    text(note, x, 51, 7.5, muted);
  });

  // trend (stacked bars, dashed line for the comparison period)
  text("Visits over time", M, 62, 10, ink, "bold");
  const cx = M, cy = 66, cw = 136, ch = 38;
  const max = Math.max(1, ...ctx.trend.map((b) => b.total), ...(ctx.ghost ?? []));
  doc.setDrawColor(...female); doc.line(cx, cy + ch, cx + cw, cy + ch);
  const slot = cw / Math.max(1, ctx.trend.length);
  ctx.trend.forEach((b, i) => {
    const hNew = (b.newVisits / max) * ch;
    const hRet = (b.returning / max) * ch;
    const w = Math.max(0.4, slot * 0.7);
    const x = cx + i * slot + (slot - w) / 2;
    rect(x, cy + ch - hNew, w, hNew, brand);
    rect(x, cy + ch - hNew - hRet, w, hRet, soft);
  });
  if (ctx.ghost && ctx.ghost.length > 1) {
    doc.setDrawColor(...muted); doc.setLineDashPattern([1, 1], 0);
    ctx.ghost.slice(0, ctx.trend.length).forEach((v, i, arr) => {
      if (i === 0) return;
      doc.line(cx + (i - 1) * slot + slot / 2, cy + ch - (arr[i - 1] / max) * ch, cx + i * slot + slot / 2, cy + ch - (v / max) * ch);
    });
    doc.setLineDashPattern([], 0);
  }
  text(ctx.trend[0]?.label ?? "", cx, cy + ch + 4, 7, muted);
  text(ctx.trend[ctx.trend.length - 1]?.label ?? "", cx + cw, cy + ch + 4, 7, muted, "normal", "right");
  text(`Peak ${max.toLocaleString()}`, cx, cy - 1, 7, muted);
  rect(cx + cw - 52, cy - 4, 2.5, 2.5, brand); text("New", cx + cw - 48.5, cy - 2, 7, muted);
  rect(cx + cw - 38, cy - 4, 2.5, 2.5, soft); text("Returning", cx + cw - 34.5, cy - 2, 7, muted);

  // age and sex
  const px = 160;
  text("Age and sex", px, 62, 10, ink, "bold");
  const peak = Math.max(1, ...ctx.pyramid.flatMap((r) => [r.male, r.female]));
  ctx.pyramid.forEach((r, i) => {
    const y = 67 + i * 5;
    text(r.band, px, y + 3, 7, muted);
    rect(px + 16, y, (r.male / peak) * 80, 1.9, male);
    rect(px + 16, y + 2, (r.female / peak) * 80, 1.9, female);
    text(`${r.male} / ${r.female}`, px + 16 + Math.max(r.male, r.female) / peak * 80 + 2, y + 3.3, 6.5, muted);
  });
  rect(px + 16, 124, 2.5, 2.5, male); text("Male", px + 20, 126, 7, muted);
  rect(px + 34, 124, 2.5, 2.5, female); text("Female", px + 38, 126, 7, muted);

  // top areas
  text("Top areas", M, 117, 10, ink, "bold");
  const topAreas = ctx.areas.slice(0, 6);
  const areaMax = Math.max(1, ...topAreas.map((a) => a.count));
  topAreas.forEach((a, i) => {
    const y = 122 + i * 6;
    text(a.name.slice(0, 22), M, y + 3, 8, ink);
    rect(M + 44, y, (a.count / areaMax) * 70, 3.4, brand);
    text(`${a.count.toLocaleString()} (${Math.round(a.share * 100)}%)`, M + 46 + (a.count / areaMax) * 70, y + 3, 7, muted);
  });

  // busy times
  const topDay = ctx.weekday.totals.indexOf(Math.max(...ctx.weekday.totals));
  text("Busy times", M, 163, 10, ink, "bold");
  if (ctx.weekday.totals[topDay] > 0) text(`Busiest weekday: ${WEEKDAYS[topDay]} (${ctx.weekday.totals[topDay].toLocaleString()} visits).`, M, 169, 8.5);
  if (ctx.heat.withHour > 0) {
    let d = 0, h = 0;
    ctx.heat.grid.forEach((row, di) => row.forEach((n, hi) => { if (n > ctx.heat.grid[d][h]) { d = di; h = hi; } }));
    text(`Busiest hour: ${WEEKDAYS[d]} ${h}:00 to ${h + 1}:00.`, M, 174, 8.5);
  }

  // notes
  text("Notes", px, 134, 10, ink, "bold");
  ctx.insights.slice(0, 5).forEach((line, i) => {
    const wrapped = doc.splitTextToSize(`• ${line}`, 125) as string[];
    text(wrapped.slice(0, 2).join("\n"), px, 140 + i * 9, 8.5);
  });
  if (ctx.quality && ctx.quality.total > 0) {
    const worst = [...ctx.quality.fields].sort((a, b) => b.pct - a.pct)[0];
    text(`Data quality: ${worst.pct}% of ${ctx.quality.total.toLocaleString()} new records are missing ${worst.label.toLowerCase()}.`, px, 188, 8, muted);
  }

  doc.setDrawColor(...soft);
  doc.line(M, 199, 90, 199); doc.line(110, 199, 170, 199); doc.line(190, 199, 285, 199);
  text("Prepared by", M, 203, 7.5, muted); text("Date", 110, 203, 7.5, muted); text("Signature", 190, 203, 7.5, muted);
  doc.save(filename);
}
