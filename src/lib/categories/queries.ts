import "server-only";
import { and, asc, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, categoryGroups, transactions } from "@/db/schema";

export interface CategoryGroupWithCategories {
  id: string;
  name: string;
  categories: (typeof categories.$inferSelect)[];
}

export async function listCategoryGroupsWithCategories(
  userId: string
): Promise<CategoryGroupWithCategories[]> {
  const groups = await db
    .select()
    .from(categoryGroups)
    .where(eq(categoryGroups.userId, userId))
    .orderBy(asc(categoryGroups.sortOrder));

  const allCategories = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.isArchived, false)))
    .orderBy(asc(categories.sortOrder));

  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    categories: allCategories.filter((category) => category.groupId === group.id),
  }));
}

export async function listArchivedCategories(userId: string) {
  return db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.isArchived, true)))
    .orderBy(asc(categories.name));
}

export async function listCategoryGroups(userId: string) {
  return db
    .select()
    .from(categoryGroups)
    .where(eq(categoryGroups.userId, userId))
    .orderBy(asc(categoryGroups.sortOrder));
}

export async function listCategories(userId: string) {
  return db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.isArchived, false)))
    .orderBy(asc(categories.sortOrder));
}

// The categories Quick Payout Allocation pre-loads: whichever categories
// the user has tagged with a priority, ordered P1 first. See CLAUDE.md /
// src/lib/dashboard/queries.ts for why this isn't hardcoded by name.
export async function listPriorityCategories(userId: string) {
  return db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.userId, userId),
        eq(categories.isArchived, false),
        isNotNull(categories.priority)
      )
    )
    .orderBy(asc(categories.priority), asc(categories.sortOrder));
}

export async function getCategory(userId: string, categoryId: string) {
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));
  return category;
}

// How much has been allocated into each category so far this calendar
// month -- what a "set_aside_monthly" or "by_date" target's funded status
// is measured against (unlike allocatedBalance, which carries over and
// never resets, so it can't tell "already funded this month" from "funded
// two months ago and never spent since"). See src/lib/categories/targets.ts.
export async function getAllocatedThisMonthByCategory(
  userId: string
): Promise<Record<string, string>> {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 10);

  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "allocation"),
        gte(transactions.date, start),
        lt(transactions.date, end)
      )
    )
    .groupBy(transactions.categoryId);

  const result: Record<string, string> = {};
  for (const row of rows) {
    if (row.categoryId) result[row.categoryId] = row.total;
  }
  return result;
}
