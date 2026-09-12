import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { payees, transactions } from "@/db/schema";
import { normalizePayee } from "@/lib/subscriptions/detect";
import type { ExistingTransactionSignature, ImportPayeeInfo } from "./matching";

// Fetches exactly what buildImportPreview needs: every payee (for
// suggestion) and every existing transaction on the chosen account that
// has a payee/source (for duplicate detection) -- a transfer or
// reallocation on this account wouldn't have a source and is filtered out
// automatically, so it can never falsely match an imported row.
export async function getImportReferenceData(
  userId: string,
  accountId: string
): Promise<{ payeeInfos: ImportPayeeInfo[]; existingSignatures: ExistingTransactionSignature[] }> {
  const [payeeRows, transactionRows] = await Promise.all([
    db
      .select({ name: payees.name, lastCategoryId: payees.lastCategoryId })
      .from(payees)
      .where(eq(payees.userId, userId)),
    db
      .select({ date: transactions.date, amount: transactions.amount, source: transactions.source })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.accountId, accountId))),
  ]);

  const existingSignatures: ExistingTransactionSignature[] = transactionRows
    .filter((row): row is typeof row & { source: string } => !!row.source?.trim())
    .map((row) => ({ date: row.date, amount: row.amount, payeeKey: normalizePayee(row.source) }));

  return { payeeInfos: payeeRows, existingSignatures };
}
