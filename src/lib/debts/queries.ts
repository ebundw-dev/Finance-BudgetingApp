import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, categories, debts } from "@/db/schema";

export interface DebtRow {
  id: string;
  accountId: string;
  accountName: string;
  currentBalance: string;
  startingBalance: string;
  minimumPayment: string | null;
  apr: string | null;
  targetPayoffDate: string | null;
  categoryId: string;
  categoryName: string;
  reservedBalance: string;
}

// Joins in the reserve category (debts.category_id, from CLAUDE.md's debt
// reserve category mechanic) alongside the account's actual owed balance,
// so the two can be shown together -- they should track each other as long
// as every charge/payment against this debt has gone through the
// accounting engine.
export async function listDebts(userId: string): Promise<DebtRow[]> {
  return db
    .select({
      id: debts.id,
      accountId: debts.accountId,
      accountName: accounts.name,
      currentBalance: accounts.currentBalance,
      startingBalance: debts.startingBalance,
      minimumPayment: debts.minimumPayment,
      apr: debts.apr,
      targetPayoffDate: debts.targetPayoffDate,
      categoryId: debts.categoryId,
      categoryName: categories.name,
      reservedBalance: categories.allocatedBalance,
    })
    .from(debts)
    .innerJoin(accounts, eq(debts.accountId, accounts.id))
    .innerJoin(categories, eq(debts.categoryId, categories.id))
    .where(eq(debts.userId, userId))
    .orderBy(accounts.name);
}

export async function getDebt(userId: string, debtId: string): Promise<DebtRow | undefined> {
  const rows = await db
    .select({
      id: debts.id,
      accountId: debts.accountId,
      accountName: accounts.name,
      currentBalance: accounts.currentBalance,
      startingBalance: debts.startingBalance,
      minimumPayment: debts.minimumPayment,
      apr: debts.apr,
      targetPayoffDate: debts.targetPayoffDate,
      categoryId: debts.categoryId,
      categoryName: categories.name,
      reservedBalance: categories.allocatedBalance,
    })
    .from(debts)
    .innerJoin(accounts, eq(debts.accountId, accounts.id))
    .innerJoin(categories, eq(debts.categoryId, categories.id))
    .where(and(eq(debts.id, debtId), eq(debts.userId, userId)));
  return rows[0];
}
