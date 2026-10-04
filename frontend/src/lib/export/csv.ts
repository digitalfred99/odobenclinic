type CsvValue = string | number | null | undefined;

function serializeCell(value: CsvValue): string {
  const text = value == null ? "" : String(value);
  const safeText = typeof value === "string" && /^[\u0000-\u0020]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

export function serializeCsv(rows: ReadonlyArray<ReadonlyArray<CsvValue>>): string {
  return rows.map((row) => row.map(serializeCell).join(",")).join("\r\n");
}