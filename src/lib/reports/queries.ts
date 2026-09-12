import "server-only";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, categoryGroups, transactions, transactionSplits } from "@/db/schema";

function monthDateRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const toDateString = (d: Date) => d.toISOString().slice(0, 10);
  return { start: toDateString(start), end: toDateString(end) };
}

export interface CategorySpendingRow {
  categoryId: string;
  categoryName: string;
  groupName: string;
  total: string;
}

// "Where did the money actually go" for one month, by category. Only
// transactions.categoryId / transactionSplits.categoryId are ever summed
// here -- never relatedCategoryId -- so a credit-card purchase's debt
// reserve credit (see CLAUDE.md's debt reserve category mechanic) never
// shows up as "spending", and paying off the card later (type
// debt_payment, not expense) doesn't either. A split expense keeps
// categoryId null on its own transactions row (the breakdown lives in
// transaction_splits instead), so a plain groupBy would miss it entirely
// or double-count it -- this runs the two cases as separate grouped
// queries and merges them in JS, the same way getProgressData merges
// per-month category snapshots.
export async function getCategorySpendingForMonth(
  userId: string,
  year: number,
  month: number
): Promise<CategorySpendingRow[]> {
  const { start, end } = monthDateRange(year, month);
  const dateFilter = and(
    eq(transactions.userId, userId),
    eq(transactions.type, "expense"),
    gte(transactions.date, start),
    lt(transactions.date, end)
  );

  const nonSplitRows = await db
    .select({
      categoryId: categories.id,
      categoryName: categories.name,
      groupName: categoryGroups.name,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
    .where(dateFilter)
    .groupBy(categories.id, categories.name, categoryGroups.name);

  const splitRows = await db
    .select({
      categoryId: categories.id,
      categoryName: categories.name,
      groupName: categoryGroups.name,
      total: sql<string>`coalesce(sum(${transactionSplits.amount}), 0)`,
    })
    .from(transactionSplits)
    .innerJoin(transactions, eq(transactionSplits.transactionId, transactions.id))
    .innerJoin(categories, eq(transactionSplits.categoryId, categories.id))
    .innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
    .where(dateFilter)
    .groupBy(categories.id, categories.name, categoryGroups.name);

  const totalsByCategory = new Map<string, CategorySpendingRow>();
  for (const row of [...nonSplitRows, ...splitRows]) {
    const existing = totalsByCategory.get(row.categoryId);
    if (existing) {
      existing.total = (Number(existing.total) + Number(row.total)).toFixed(2);
    } else {
      totalsByCategory.set(row.categoryId, { ...row, total: Number(row.total).toFixed(2) });
    }
  }

  return [...totalsByCategory.values()].sort((a, b) => Number(b.total) - Number(a.total));
}
