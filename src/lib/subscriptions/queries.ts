import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  accounts,
  categories,
  dismissedSubscriptionCandidates,
  scheduledTransactions,
  transactions,
} from "@/db/schema";
import {
  detectRecurringCandidates,
  normalizePayee,
  type DetectableExpense,
  type DismissedSignature,
  type ExistingScheduleSignature,
  type SubscriptionCandidate,
} from "./detect";

export interface SubscriptionCandidateDisplay extends SubscriptionCandidate {
  accountName: string;
  categoryName: string;
}

// Runs detection live against the whole expense history on every call --
// same "no cron needed" approach as the Scheduled page's due/upcoming
// queries. Only expense rows with both an account and a (non-split)
// category qualify: a split expense's category breakdown lives in
// transaction_splits, not on the transaction row, and attributing a split
// purchase to a single category would misrepresent it.
export async function getSubscriptionCandidates(userId: string): Promise<SubscriptionCandidateDisplay[]> {
  const [expenseRows, scheduleRows, dismissedRows, accountRows, categoryRows] = await Promise.all([
    db
      .select({
        id: transactions.id,
        accountId: transactions.accountId,
        categoryId: transactions.categoryId,
        amount: transactions.amount,
        date: transactions.date,
        source: transactions.source,
      })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.type, "expense"))),
    db
      .select({
        accountId: scheduledTransactions.accountId,
        categoryId: scheduledTransactions.categoryId,
        description: scheduledTransactions.description,
      })
      .from(scheduledTransactions)
      .where(eq(scheduledTransactions.userId, userId)),
    db
      .select({
        accountId: dismissedSubscriptionCandidates.accountId,
        categoryId: dismissedSubscriptionCandidates.categoryId,
        payeeKey: dismissedSubscriptionCandidates.payeeKey,
      })
      .from(dismissedSubscriptionCandidates)
      .where(eq(dismissedSubscriptionCandidates.userId, userId)),
    db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(eq(accounts.userId, userId)),
    db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.userId, userId)),
  ]);

  const expenses: DetectableExpense[] = expenseRows
    .filter(
      (r): r is typeof r & { accountId: string; categoryId: string; source: string } =>
        r.accountId !== null && r.categoryId !== null && r.source !== null && r.source.trim() !== ""
    )
    .map((r) => ({
      id: r.id,
      accountId: r.accountId,
      categoryId: r.categoryId,
      amount: r.amount,
      date: r.date,
      source: r.source,
    }));

  const existingSchedules: ExistingScheduleSignature[] = scheduleRows
    .filter((r): r is typeof r & { accountId: string } => r.accountId !== null)
    .map((r) => ({
      accountId: r.accountId,
      categoryId: r.categoryId,
      payeeKey: normalizePayee(r.description),
    }));

  const dismissed: DismissedSignature[] = dismissedRows.map((r) => ({
    accountId: r.accountId,
    categoryId: r.categoryId,
    payeeKey: r.payeeKey,
  }));

  const candidates = detectRecurringCandidates(expenses, existingSchedules, dismissed);

  const accountNames = new Map(accountRows.map((a) => [a.id, a.name]));
  const categoryNames = new Map(categoryRows.map((c) => [c.id, c.name]));

  return candidates.map((c) => ({
    ...c,
    accountName: accountNames.get(c.accountId) ?? "Unknown account",
    categoryName: categoryNames.get(c.categoryId) ?? "Unknown category",
  }));
}

export async function getNewSubscriptionCount(userId: string): Promise<number> {
  const candidates = await getSubscriptionCandidates(userId);
  return candidates.length;
}
