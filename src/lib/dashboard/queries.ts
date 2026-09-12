import "server-only";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, categories, debts, transactions, users } from "@/db/schema";
import { getAllocatedThisMonthByCategory } from "@/lib/categories/queries";
import type { TargetType } from "@/lib/categories/targets";
import { getDueAndUpcomingCounts } from "@/lib/scheduled/queries";
import { getNewSubscriptionCount } from "@/lib/subscriptions/queries";

export interface GoalCategoryProgress {
  id: string;
  name: string;
  allocatedBalance: string;
  targetType: TargetType;
  targetAmount: string;
  targetDate: string | null;
  allocatedThisMonth: string;
}

export interface EarmarkedCategory {
  name: string;
  allocatedBalance: string;
}

export interface DashboardData {
  phase: string;
  totalCash: string;
  unallocatedCash: string;
  totalDebt: string;
  netFinancialPosition: string;
  incomeThisMonth: string;
  spendingThisMonth: string;
  debtPaidThisMonth: string;
  goalProgress: GoalCategoryProgress[];
  earmarked: EarmarkedCategory[];
  dueScheduledCount: number;
  upcomingScheduledCount: number;
  newSubscriptionCount: number;
}

function currentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const toDateString = (d: Date) => d.toISOString().slice(0, 10);
  return { start: toDateString(start), end: toDateString(end) };
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const { start, end } = currentMonthRange();

  const [
    [user],
    [cashRow],
    [allocatedRow],
    [debtRow],
    [monthlyRow],
    goalCategories,
    allocatedThisMonth,
    { dueCount, upcomingCount },
    newSubscriptionCount,
  ] = await Promise.all([
      db.select({ phase: users.phase }).from(users).where(eq(users.id, userId)),
      db
        .select({
          totalCash: sql<string>`coalesce(sum(${accounts.currentBalance}), 0)`,
        })
        .from(accounts)
        .where(and(eq(accounts.userId, userId), eq(accounts.isCashAccount, true))),
      db
        .select({
          totalAllocated: sql<string>`coalesce(sum(${categories.allocatedBalance}), 0)`,
        })
        .from(categories)
        .where(eq(categories.userId, userId)),
      db
        .select({
          totalDebt: sql<string>`coalesce(sum(${accounts.currentBalance}), 0)`,
        })
        .from(debts)
        .innerJoin(accounts, eq(debts.accountId, accounts.id))
        .where(eq(debts.userId, userId)),
      db
        .select({
          income: sql<string>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount} else 0 end), 0)`,
          spending: sql<string>`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amount} else 0 end), 0)`,
          debtPaid: sql<string>`coalesce(sum(case when ${transactions.type} = 'debt_payment' then ${transactions.amount} else 0 end), 0)`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            gte(transactions.date, start),
            lt(transactions.date, end)
          )
        ),
      db
        .select({
          id: categories.id,
          name: categories.name,
          allocatedBalance: categories.allocatedBalance,
          targetType: categories.targetType,
          targetAmount: categories.targetAmount,
          targetDate: categories.targetDate,
        })
        .from(categories)
        .where(and(eq(categories.userId, userId), eq(categories.categoryType, "goal")))
        .orderBy(categories.sortOrder),
      getAllocatedThisMonthByCategory(userId),
      getDueAndUpcomingCounts(userId),
      getNewSubscriptionCount(userId),
    ]);

  const totalCash = cashRow.totalCash;
  const totalDebt = debtRow.totalDebt;
  const unallocatedCash = (Number(totalCash) - Number(allocatedRow.totalAllocated)).toFixed(2);
  const netFinancialPosition = (Number(totalCash) - Number(totalDebt)).toFixed(2);

  // A goal category with a target type gets shown against that target
  // (see src/lib/categories/targets.ts for the three flavors); one without
  // a target is shown as a flat "earmarked" balance instead (Investments,
  // which doesn't have a fixed target the way a savings goal does). Driven
  // by whether target_type is set, not by category name, so this holds
  // regardless of how the user renames or adds categories later.
  const goalProgress: GoalCategoryProgress[] = [];
  const earmarked: EarmarkedCategory[] = [];
  for (const category of goalCategories) {
    if (category.targetType !== null && category.targetAmount !== null) {
      goalProgress.push({
        id: category.id,
        name: category.name,
        allocatedBalance: category.allocatedBalance,
        targetType: category.targetType,
        targetAmount: category.targetAmount,
        targetDate: category.targetDate,
        allocatedThisMonth: allocatedThisMonth[category.id] ?? "0",
      });
    } else {
      earmarked.push({
        name: category.name,
        allocatedBalance: category.allocatedBalance,
      });
    }
  }

  return {
    phase: user.phase,
    totalCash,
    unallocatedCash,
    totalDebt,
    netFinancialPosition,
    incomeThisMonth: monthlyRow.income,
    spendingThisMonth: monthlyRow.spending,
    debtPaidThisMonth: monthlyRow.debtPaid,
    goalProgress,
    earmarked,
    dueScheduledCount: dueCount,
    upcomingScheduledCount: upcomingCount,
    newSubscriptionCount,
  };
}
