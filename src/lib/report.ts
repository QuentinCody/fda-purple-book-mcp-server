/** FDA documents two sections: monthly changes, then the complete monthly snapshot.
 * https://purplebooksearch.fda.gov/downloads
 * Preserve every full-section row: a BLA can have multiple strengths/presentations.
 */
import { parseCsv } from "./csv";
export { parseCsv } from "./csv";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Keep original dates; derived ISO values require an unambiguous calendar date. */
function isoDate(raw: string, future: boolean, reportYear: number | null): string | null {
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (slash) {
    const iso = `${slash[3]}-${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}`;
    return validDate(iso) ? iso : null;
  }
  const match = /^(\d{1,2})-([a-z]{3,})-(\d{2}|\d{4})$/i.exec(raw);
  if (!match) return /^\d{4}-\d{2}-\d{2}$/.test(raw) && validDate(raw) ? raw : null;
  const month = MONTHS.indexOf(match[2].slice(0, 3).toLowerCase()) + 1;
  let year = Number(match[3]);
  if (match[3].length === 2) {
    if (reportYear === null) return null;
    year += 2000;
    if (!future && year > reportYear) year -= 100;
  }
  const iso = `${year}-${String(month).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  return month && validDate(iso) ? iso : null;
}

function validDate(value: string): boolean {
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function columnKeys(row: string[]): string[] {
  return row.map(value => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""));
}

export interface NativeRow { csv_record: number; values: string[] }

function section(rows: string[][], header: string[], year: number | null, firstRecord: number) {
  const records: Record<string, string>[] = [];
  const nativeRows: NativeRow[] = [];
  const notes: string[][] = [];
  const bla = header.indexOf("bla_number");
  for (const [index, cells] of rows.entries()) {
    if (cells.every(cell => !cell.trim())) continue;
    if (!/^\d+$/.test(cells[bla]?.trim() ?? "")) { notes.push(cells); continue; }
    if (cells.length !== header.length) throw new Error("Purple Book row width differs from its header");
    const record: Record<string, string> = {};
    header.forEach((key, i) => { if (key) record[key] = cells[i]; });
    for (const [key, value] of Object.entries(record)) {
      if ((!key.endsWith("_date") && key !== "date_of_first_licensure") || !value || `${key}_iso` in record) continue;
      const iso = isoDate(value.trim(), /exclus|expir/.test(key), year);
      if (iso) record[`${key}_iso`] = iso;
    }
    records.push(record);
    nativeRows.push({ csv_record: firstRecord + index, values: cells });
  }
  return { records, notes, nativeRows };
}

export interface ParsedPurpleBookReport {
  records: Record<string, string>[];
  changes: Record<string, string>[];
  reportPreamble: string[][];
  sectionNotes: { changes: string[][]; products: string[][] };
  nativeHeaders: { changes: string[]; products: string[] };
  nativeRows: { changes: NativeRow[]; products: NativeRow[] };
  layout: "changes_and_products" | "full_snapshot_only";
  changesAvailable: boolean;
}

export function parseReport(text: string, reportMonth: string | null): ParsedPurpleBookReport {
  const rows = parseCsv(text);
  const headers = rows.flatMap((row, index) => {
    const names = columnKeys(row);
    return names.includes("bla_number") && names.includes("applicant") ? [index] : [];
  });
  const single = headers.length === 1 && headers[0] === 0 && ["proprietary_name", "proper_name", "bla_type", "approval_date"].every(key => columnKeys(rows[0]).includes(key));
  if (headers.length !== 2 && !single) throw new Error("Expected separate Purple Book changes and full-snapshot headers or the native legacy single-header layout");
  const first = headers[0]; const last = headers[headers.length - 1];
  const changeKeys = single ? [] : columnKeys(rows[first]);
  const productKeys = columnKeys(rows[last]);
  for (const names of [changeKeys, productKeys]) {
    const nonempty = names.filter(Boolean);
    if (new Set(nonempty).size !== nonempty.length) throw new Error("Ambiguous Purple Book columns");
  }
  const year = reportMonth ? Number(reportMonth.slice(0, 4)) : null;
  const changes = single ? { records: [], notes: [], nativeRows: [] } : section(rows.slice(first + 1, last), changeKeys, year, first + 2);
  const products = section(rows.slice(last + 1), productKeys, year, last + 2);
  if (!products.records.length) throw new Error("Purple Book full snapshot has no product rows");
  return { records: products.records, changes: changes.records,
    reportPreamble: rows.slice(0, first).filter(row => row.some(Boolean)),
    sectionNotes: { changes: changes.notes, products: products.notes },
    nativeHeaders: { changes: single ? [] : rows[first], products: rows[last] },
    nativeRows: { changes: changes.nativeRows, products: products.nativeRows },
    layout: single ? "full_snapshot_only" : "changes_and_products", changesAvailable: !single };
}
