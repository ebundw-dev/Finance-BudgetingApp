"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { AccountingError, ValidationError } from "@/lib/accounting/errors";
import { recordExpense, recordIncome } from "@/lib/accounting/engine";
import { verifySession } from "@/lib/auth/dal";
import { recordPayeeUsage } from "@/lib/payees/service";
import type { ImportDirection, NormalizedImportRow } from "./csv";
import { buildImportPreview, type ImportPreviewRow } from "./matching";
import { getImportReferenceData } from "./queries";

// FormData-based, like every other action in this codebase (see
// src/lib/transactions/actions.ts) -- driven from useActionState rather
// than a redirecting <form>, since this step needs to hand structured
// data back into the client wizard instead of navigating away. The
// client has already parsed the file and normalized rows itself (pure
// logic, see csv.ts); this only supplies the DB-backed part
// (existing payees/transactions) that buildImportPreview needs.
export async function getImportPreviewAction(
  _prevState: ImportPreviewRow[] | null,
  formData: FormData
): Promise<ImportPreviewRow[]> {
  const { userId } = await verifySession();
  const accountId = String(formData.get("accountId") ?? "");
  const rows = JSON.parse(String(formData.get("rowsJson") ?? "[]")) as NormalizedImportRow[];

  const { payeeInfos, existingSignatures } = await getImportReferenceData(userId, accountId);
  return buildImportPreview(rows, payeeInfos, existingSignatures);
}

export interface FinalImportRow {
  date: string;
  payeeRaw: string;
  amount: string;
  direction: ImportDirection;
  categoryId: string | null;
  isDuplicate: boolean;
}

export interface ImportSummary {
  imported: number;
  excluded: number;
  duplicatesIncluded: number;
  failed: { payee: string; message: string }[];
}

// Posts each included row through the exact same accounting engine
// functions (recordExpense/recordIncome) and payee-tracking helper
// (recordPayeeUsage) manual entry uses -- no parallel posting path. Each
// row is its own db.transaction, so one row failing (e.g. insufficient
// category balance) doesn't roll back the rest of the batch; it's
// reported in `failed` instead of silently dropped or aborting the import.
export async function importTransactionsAction(
  _prevState: ImportSummary | null,
  formData: FormData
): Promise<ImportSummary> {
  const { userId } = await verifySession();
  const accountId = String(formData.get("accountId") ?? "");
  const includedRows = JSON.parse(String(formData.get("rowsJson") ?? "[]")) as FinalImportRow[];
  const excludedCount = Number(formData.get("excludedCount") ?? 0);

  let imported = 0;
  let duplicatesIncluded = 0;
  const failed: { payee: string; message: string }[] = [];

  for (const row of includedRows) {
    if (row.isDuplicate) duplicatesIncluded++;

    try {
      await db.transaction(async (tx) => {
        if (row.direction === "debit") {
          if (!row.categoryId) {
            throw new ValidationError("No category selected.");
          }
          const txn = await recordExpense(tx, userId, {
            accountId,
            categoryId: row.categoryId,
            amount: row.amount,
            date: row.date,
            source: row.payeeRaw,
          });
          const payeeId = await recordPayeeUsage(tx, userId, row.payeeRaw, row.categoryId);
          await tx.update(transactions).set({ payeeId }).where(eq(transactions.id, txn.id));
        } else {
          // Income isn't wired into payee tracking, matching manual income
          // entry (see src/lib/transactions/actions.ts): payee tracking is
          // an expense-entry convenience only.
          await recordIncome(tx, userId, {
            accountId,
            amount: row.amount,
            date: row.date,
            source: row.payeeRaw,
          });
        }
      });
      imported++;
    } catch (error) {
      const message = error instanceof AccountingError ? error.message : "Unexpected error.";
      failed.push({ payee: row.payeeRaw, message });
    }
  }

  return { imported, excluded: excludedCount, duplicatesIncluded, failed };
}
