import { and, eq, sql } from "drizzle-orm";
import { payees } from "@/db/schema";
import { normalizePayee } from "@/lib/subscriptions/detect";
import type { Tx } from "@/lib/accounting/engine";

// Finds-or-creates a payee for this user by normalized name and records
// this transaction's use against it: bumps useCount, and -- only when a
// single category actually applies (i.e. everything but a split expense,
// where "the" category used is ambiguous) -- updates lastCategoryId to
// whatever category was used this time. Runs inside the same db
// transaction as the accounting engine call it accompanies, so the
// payee_id FK write lands atomically with the transaction row, but never
// touches the accounting engine itself (categories/accounts/transactions
// balances) -- this table is purely a data-entry convenience layer.
export async function recordPayeeUsage(
  tx: Tx,
  userId: string,
  rawName: string,
  categoryId: string | null
): Promise<string> {
  const name = normalizePayee(rawName);

  const [existing] = await tx
    .select()
    .from(payees)
    .where(and(eq(payees.userId, userId), eq(payees.name, name)));

  if (existing) {
    await tx
      .update(payees)
      .set({
        useCount: sql`${payees.useCount} + 1`,
        ...(categoryId ? { lastCategoryId: categoryId } : {}),
      })
      .where(eq(payees.id, existing.id));
    return existing.id;
  }

  const [created] = await tx
    .insert(payees)
    .values({ userId, name, lastCategoryId: categoryId, useCount: 1 })
    .returning();
  return created.id;
}
