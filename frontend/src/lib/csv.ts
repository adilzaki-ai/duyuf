/**
 * A spreadsheet saved as CSV, read into rows keyed by the header line.
 *
 * Handles what Excel and Google Sheets write: quoted cells with commas, quotes
 * doubled inside quotes, line breaks inside quotes, CRLF, a byte-order mark,
 * and semicolons as the separator (Excel's choice in many locales). Blank
 * lines are skipped. Header names are trimmed and lower-cased.
 */
export function parseCsv(text: string): { columns: string[]; rows: Record<string, string>[] } {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const lines: string[][] = [];
  let cell = "";
  let line: string[] = [];
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === sep) {
      line.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      line.push(cell);
      lines.push(line);
      line = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || line.length) {
    line.push(cell);
    lines.push(line);
  }

  const nonBlank = lines.filter((l) => l.some((x) => x.trim() !== ""));
  if (nonBlank.length === 0) return { columns: [], rows: [] };
  const columns = nonBlank[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows = nonBlank.slice(1).map((l) => Object.fromEntries(columns.map((c, i) => [c, (l[i] ?? "").trim()])));
  return { columns, rows };
}

/** One CSV line, quoting what needs it. */
export function csvLine(cells: readonly string[]): string {
  return cells.map((c) => (/[",\n\r;]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",");
}
