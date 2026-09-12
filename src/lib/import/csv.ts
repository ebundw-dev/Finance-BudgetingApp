// Pure CSV parsing and column-mapping logic for the manual bank/card
// statement importer -- no DB access, no bank-format assumptions beyond
// "some column is a date, some column is a payee, and amount is either one
// signed column or a debit/credit pair". See src/lib/import/matching.ts
// for the DB-aware suggestion/duplicate-detection layer built on top of
// this, and src/lib/import/queries.ts + actions.ts for the parts that
// actually touch the database.

// A minimal RFC4180-ish CSV parser: handles quoted fields (including
// embedded commas/newlines), "" as an escaped quote inside a quoted
// field, and both \r\n and \n line endings. Blank lines are dropped
// rather than surfaced as single-empty-field rows -- real bank exports
// don't intentionally emit those, and treating them as data rows would
// just show up as "missing date/payee/amount" noise in the preview.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  function pushField() {
    row.push(field);
    field = "";
  }
  function pushRow() {
    pushField();
    rows.push(row);
    row = [];
  }

  while (i < len) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === ",") {
      pushField();
      i++;
      continue;
    }
    if (char === "\r") {
      i++;
      continue;
    }
    if (char === "\n") {
      pushRow();
      i++;
      continue;
    }
    field += char;
    i++;
  }

  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

export type AmountMode = "single" | "debitCredit";

export interface ColumnMapping {
  hasHeaderRow: boolean;
  dateColumn: number;
  payeeColumn: number;
  amountMode: AmountMode;
  // Required when amountMode is "single".
  amountColumn?: number;
  // Required when amountMode is "debitCredit". Each column holds an
  // unsigned magnitude -- whichever one is non-zero for a row determines
  // its direction.
  debitColumn?: number;
  creditColumn?: number;
}

export type ImportDirection = "debit" | "credit";

export interface NormalizedImportRow {
  rowIndex: number;
  date: string | null; // YYYY-MM-DD, or null if unparseable
  payeeRaw: string;
  amount: string | null; // always positive, 2 decimals; null if unparseable/zero
  direction: ImportDirection | null;
  error?: string;
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// Only two unambiguous-enough formats are supported: ISO (YYYY-MM-DD) and
// US-style (MM/DD/YYYY, the overwhelming majority of US bank/card exports).
// A date that doesn't match either is left null and reported as an error
// rather than guessed at -- silently misreading DD/MM as MM/DD would
// corrupt real transaction dates.
export function parseImportDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    return isValidCalendarDate(Number(y), Number(m), Number(d)) ? `${y}-${m}-${d}` : null;
  }

  const us = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    const [, m, d, y] = us;
    if (!isValidCalendarDate(Number(y), Number(m), Number(d))) return null;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return null;
}

// Accepts common bank-statement amount formatting: a leading "$", thousands
// commas, a leading "-" or wrapping parentheses for negatives. Returns a
// signed number, or null if the text isn't recognizable as an amount.
export function parseImportAmount(raw: string): number | null {
  let text = raw.trim().replace(/[$\s]/g, "");
  if (!text) return null;

  let negative = false;
  if (text.startsWith("(") && text.endsWith(")")) {
    negative = true;
    text = text.slice(1, -1);
  }
  text = text.replace(/,/g, "");
  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1);
  } else if (text.startsWith("+")) {
    text = text.slice(1);
  }

  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  if (Number.isNaN(value)) return null;
  return negative ? -value : value;
}

function resolveSignedAmount(raw: string[], mapping: ColumnMapping): number | null {
  if (mapping.amountMode === "single") {
    return parseImportAmount(raw[mapping.amountColumn!] ?? "");
  }

  const debit = parseImportAmount(raw[mapping.debitColumn!] ?? "");
  const credit = parseImportAmount(raw[mapping.creditColumn!] ?? "");
  if (debit && debit !== 0) return -Math.abs(debit);
  if (credit && credit !== 0) return Math.abs(credit);
  return 0;
}

// Turns raw parsed CSV rows into typed, validated candidates given a
// column mapping. Never throws on a bad row -- an unparseable date/amount
// or missing payee just produces a row with `error` set, so the preview
// step can show every row (including the ones that can't be imported)
// rather than silently dropping them.
export function buildImportRows(rows: string[][], mapping: ColumnMapping): NormalizedImportRow[] {
  const dataRows = mapping.hasHeaderRow ? rows.slice(1) : rows;

  return dataRows.map((raw, index) => {
    const date = parseImportDate(raw[mapping.dateColumn] ?? "");
    const payeeRaw = (raw[mapping.payeeColumn] ?? "").trim();
    const signedAmount = resolveSignedAmount(raw, mapping);

    const errors: string[] = [];
    if (!date) errors.push("Unrecognized date");
    if (!payeeRaw) errors.push("Missing payee");
    if (signedAmount === null || signedAmount === 0) errors.push("Missing or invalid amount");

    if (errors.length > 0) {
      return { rowIndex: index, date, payeeRaw, amount: null, direction: null, error: errors.join("; ") };
    }

    return {
      rowIndex: index,
      date,
      payeeRaw,
      amount: Math.abs(signedAmount!).toFixed(2),
      direction: signedAmount! < 0 ? "debit" : "credit",
    };
  });
}
