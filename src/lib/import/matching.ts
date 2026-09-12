// Pure suggestion + duplicate-detection logic for the statement importer.
// Takes already-fetched reference data (existing payees, existing
// transactions for the chosen account) as plain arrays rather than
// querying the DB itself -- see src/lib/import/queries.ts for that side,
// and src/lib/import/actions.ts for where the two get wired together.
import { normalizePayee } from "@/lib/subscriptions/detect";
import type { NormalizedImportRow } from "./csv";

export interface ImportPayeeInfo {
  name: string; // already normalized, matches the payees.name convention
  lastCategoryId: string | null;
}

export interface ExistingTransactionSignature {
  date: string;
  amount: string;
  payeeKey: string; // already normalizePayee(source)
}

export interface ImportPreviewRow extends NormalizedImportRow {
  payeeKey: string | null;
  suggestedCategoryId: string | null;
  isDuplicate: boolean;
}

// A row is a possible duplicate when an existing transaction on the same
// account shares its date, amount, and fuzzy-normalized payee -- flagged,
// not silently dropped, so the user decides whether to include it anyway
// (e.g. two genuinely separate $12.00 coffee runs on the same day).
export function buildImportPreview(
  rows: NormalizedImportRow[],
  payees: ImportPayeeInfo[],
  existingTransactions: ExistingTransactionSignature[]
): ImportPreviewRow[] {
  const payeeByName = new Map(payees.map((p) => [p.name, p]));
  const existingKeys = new Set(
    existingTransactions.map((s) => `${s.date}::${s.amount}::${s.payeeKey}`)
  );

  return rows.map((row) => {
    if (row.error || !row.payeeRaw || !row.date || !row.amount) {
      return { ...row, payeeKey: null, suggestedCategoryId: null, isDuplicate: false };
    }

    const payeeKey = normalizePayee(row.payeeRaw);
    const suggestedCategoryId = payeeByName.get(payeeKey)?.lastCategoryId ?? null;
    const isDuplicate = existingKeys.has(`${row.date}::${row.amount}::${payeeKey}`);

    return { ...row, payeeKey, suggestedCategoryId, isDuplicate };
  });
}
