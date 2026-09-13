import { and, eq, gte, lt, sql } from "drizzle-orm";
import { categories, categoryGroups, transactions, transactionSplits } from "@/db/schema";
import { ValidationError } from "@/lib/accounting/errors";
import type { Tx } from "@/lib/accounting/engine";

export interface CategorySpendingRow {
  categoryId: string;
  categoryName: string;
  groupName: string;
  total: string;
}

export interface SpendingReportParams {
  year: number;
  month: number;
}

// Mirrors src/app/(app)/reports/spending/page.tsx's searchParams handling:
// defaults to the current UTC month/year when absent, otherwise requires
// a valid integer month 1-12.
export function parseSpendingReportParams(searchParams: URLSearchParams): SpendingReportParams {
  const now = new Date();
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");
  const year = yearParam !== null ? Number(yearParam) : now.getUTCFullYear();
  const month = monthParam !== null ? Number(monthParam) : now.getUTCMonth() + 1;

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new ValidationError("year and month must be integers, with month between 1 and 12.");
  }

  return { year, month };
}

function monthDateRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const toDateString = (d: Date) => d.toISOString().slice(0, 10);
  return { start: toDateString(start), end: toDateString(end) };
}

// Inlined rather than calling src/lib/reports/queries.ts's
// getCategorySpendingForMonth -- that file is marked "server-only" (a
// Next.js build-time guard against leaking into client bundles), which
// vitest's plain Node environment can't satisfy. Identical query/merge
// logic (see that file's own comment for why split and non-split
// expenses need two grouped queries merged in JS) -- a separate copy for
// the same reason every other src/lib/api/*.ts file is: testability, not
// a rule change.
export async function getSpendingForMonth(
  tx: Tx,
  userId: string,
  { year, month }: SpendingReportParams
): Promise<CategorySpendingRow[]> {
  const { start, end } = monthDateRange(year, month);
  const dateFilter = and(
    eq(transactions.userId, userId),
    eq(transactions.type, "expense"),
    gte(transactions.date, start),
    lt(transactions.date, end)
  );

  const nonSplitRows = await tx
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

  const splitRows = await tx
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
