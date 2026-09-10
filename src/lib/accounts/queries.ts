import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, debts } from "@/db/schema";

export async function listAccounts(userId: string) {
  return db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isArchived, false)))
    .orderBy(accounts.name);
}

export async function listCashAccounts(userId: string) {
  return db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.isArchived, false),
        eq(accounts.isCashAccount, true)
      )
    )
    .orderBy(accounts.name);
}

// Accounts backed by a debts row -- valid targets for a debt payment's
// debtAccountId. Not just "every credit card": an account only counts once
// it has the debts row (and reserve category) that recordDebtPayment needs.
export async function listDebtAccounts(userId: string) {
  return db
    .select({
      id: accounts.id,
      name: accounts.name,
      type: accounts.type,
      currentBalance: accounts.currentBalance,
    })
    .from(debts)
    .innerJoin(accounts, eq(debts.accountId, accounts.id))
    .where(and(eq(debts.userId, userId), eq(accounts.isArchived, false)))
    .orderBy(accounts.name);
}

export async function listCreditCardAccounts(userId: string) {
  return db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.isArchived, false),
        eq(accounts.type, "credit_card")
      )
    )
    .orderBy(accounts.name);
}
