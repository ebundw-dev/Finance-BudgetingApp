import "server-only";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { categories, categoryGroups } from "@/db/schema";

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
