import "server-only";
import { and, asc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  accounts,
  categories,
  debts,
  monthCategorySnapshots,
  months,
  transactions,
} from "@/db/schema";

function monthDateRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const toDateString = (d: Date) => d.toISOString().slice(0, 10);
  return { start: toDateString(start), end: toDateString(end) };
}

export interface MonthlyTransactionTotals {
  income: string;
  spending: string;
  debtPaid: string;
  savings: string;
}

// Works for any month, past or present, since transactions are immutable
// historical records -- no snapshot needed for these figures.
export async function getMonthlyTransactionTotals(
  userId: string,
  year: number,
  month: number
): Promise<MonthlyTransactionTotals> {
  const { start, end } = monthDateRange(year, month);

  const [totalsRow] = await db
    .select({
      income: sql<string>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount} else 0 end), 0)`,
      spending: sql<string>`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amount} else 0 end), 0)`,
      debtPaid: sql<string>`coalesce(sum(case when ${transactions.type} = 'debt_payment' then ${transactions.amount} else 0 end), 0)`,
    })
    .from(transactions)
    .where(
      and(eq(transactions.userId, userId), gte(transactions.date, start), lt(transactions.date, end))
    );

  // "Savings" = money allocated into goal-type categories during the month
  // -- an intentional set-aside, as opposed to spending money or debt paid.
  const [savingsRow] = await db
    .select({
      savings: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "allocation"),
        eq(categories.categoryType, "goal"),
        gte(transactions.date, start),
        lt(transactions.date, end)
      )
    );

  return { ...totalsRow, savings: savingsRow.savings };
}

export async function getCurrentAggregates(userId: string) {
  const [cashRow] = await db
    .select({ totalCash: sql<string>`coalesce(sum(${accounts.currentBalance}), 0)` })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isCashAccount, true)));

  const [allocatedRow] = await db
    .select({ totalAllocated: sql<string>`coalesce(sum(${categories.allocatedBalance}), 0)` })
    .from(categories)
    .where(eq(categories.userId, userId));

  const [debtRow] = await db
    .select({ totalDebt: sql<string>`coalesce(sum(${accounts.currentBalance}), 0)` })
    .from(debts)
    .innerJoin(accounts, eq(debts.accountId, accounts.id))
    .where(eq(debts.userId, userId));

  const totalCash = cashRow.totalCash;
  const totalDebt = debtRow.totalDebt;
  const unallocatedCash = (Number(totalCash) - Number(allocatedRow.totalAllocated)).toFixed(2);

  return { totalCash, totalDebt, unallocatedCash };
}

export async function getMonthSnapshot(userId: string, year: number, month: number) {
  const [row] = await db
    .select()
    .from(months)
    .where(and(eq(months.userId, userId), eq(months.year, year), eq(months.month, month)));
  if (!row) return undefined;

  const categorySnapshots = await db
    .select({
      categoryId: monthCategorySnapshots.categoryId,
      categoryName: categories.name,
      allocatedBalance: monthCategorySnapshots.allocatedBalance,
    })
    .from(monthCategorySnapshots)
    .innerJoin(categories, eq(monthCategorySnapshots.categoryId, categories.id))
    .where(eq(monthCategorySnapshots.monthId, row.id))
    .orderBy(asc(categories.sortOrder));

  return { ...row, categorySnapshots };
}

export interface ProgressRow {
  year: number;
  month: number;
  totalCashSnapshot: string;
  totalDebtSnapshot: string;
  netPosition: string;
  income: string;
  spending: string;
  debtPaid: string;
  savings: string;
  cumulativeIncome: string;
  cumulativeDebtPaid: string;
  cumulativeSavings: string;
  categoryBalances: Record<string, string>;
}

// One row per snapshotted month (see closeMonth), chronological, with
// income/spending/debt-paid/savings computed live from transactions
// (accurate for any month) and running cumulative totals added on top.
export async function getProgressData(userId: string): Promise<ProgressRow[]> {
  const snapshots = await db
    .select()
    .from(months)
    .where(eq(months.userId, userId))
    .orderBy(asc(months.year), asc(months.month));

  if (snapshots.length === 0) return [];

  const monthIds = snapshots.map((s) => s.id);
  const allCategorySnapshots = await db
    .select({
      monthId: monthCategorySnapshots.monthId,
      categoryName: categories.name,
      allocatedBalance: monthCategorySnapshots.allocatedBalance,
    })
    .from(monthCategorySnapshots)
    .innerJoin(categories, eq(monthCategorySnapshots.categoryId, categories.id))
    .where(inArray(monthCategorySnapshots.monthId, monthIds));

  const categoryBalancesByMonthId = new Map<string, Record<string, string>>();
  for (const row of allCategorySnapshots) {
    const map = categoryBalancesByMonthId.get(row.monthId) ?? {};
    map[row.categoryName] = row.allocatedBalance;
    categoryBalancesByMonthId.set(row.monthId, map);
  }

  let cumulativeIncome = 0;
  let cumulativeDebtPaid = 0;
  let cumulativeSavings = 0;

  const rows: ProgressRow[] = [];
  for (const snapshot of snapshots) {
    const totals = await getMonthlyTransactionTotals(userId, snapshot.year, snapshot.month);
    cumulativeIncome += Number(totals.income);
    cumulativeDebtPaid += Number(totals.debtPaid);
    cumulativeSavings += Number(totals.savings);

    rows.push({
      year: snapshot.year,
      month: snapshot.month,
      totalCashSnapshot: snapshot.totalCashSnapshot,
      totalDebtSnapshot: snapshot.totalDebtSnapshot,
      netPosition: (Number(snapshot.totalCashSnapshot) - Number(snapshot.totalDebtSnapshot)).toFixed(2),
      income: totals.income,
      spending: totals.spending,
      debtPaid: totals.debtPaid,
      savings: totals.savings,
      cumulativeIncome: cumulativeIncome.toFixed(2),
      cumulativeDebtPaid: cumulativeDebtPaid.toFixed(2),
      cumulativeSavings: cumulativeSavings.toFixed(2),
      categoryBalances: categoryBalancesByMonthId.get(snapshot.id) ?? {},
    });
  }

  return rows;
}
