"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { categories, categoryGroups, categoryTypeEnum, priorityEnum } from "@/db/schema";
import { verifySession } from "@/lib/auth/dal";

const CATEGORY_TYPES = new Set(categoryTypeEnum.enumValues);
const PRIORITIES = new Set(priorityEnum.enumValues);

export async function createCategoryGroup(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    redirect(`/categories/new?error=${encodeURIComponent("Group name is required.")}`);
  }

  await db.insert(categoryGroups).values({ userId, name, sortOrder: 0 });

  redirect("/categories/new");
}

export async function createCategory(formData: FormData): Promise<void> {
  const { userId } = await verifySession();

  const groupId = String(formData.get("groupId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const categoryType = String(formData.get("categoryType") ?? "spending");

  if (!groupId || !name || !CATEGORY_TYPES.has(categoryType as (typeof categoryTypeEnum.enumValues)[number])) {
    redirect(`/categories/new?error=${encodeURIComponent("Group and name are required.")}`);
  }

  await db.insert(categories).values({
    userId,
    groupId,
    name,
    categoryType: categoryType as (typeof categoryTypeEnum.enumValues)[number],
    allocatedBalance: "0",
  });

  redirect("/categories");
}

export async function updateCategory(formData: FormData): Promise<void> {
  const { userId } = await verifySession();

  const categoryId = String(formData.get("categoryId") ?? "");
  const targetAmountRaw = String(formData.get("targetAmount") ?? "").trim();
  const priorityRaw = String(formData.get("priority") ?? "").trim();

  const targetAmount = targetAmountRaw === "" ? null : targetAmountRaw;
  const priority = priorityRaw === "" ? null : priorityRaw;

  if (targetAmount !== null && Number.isNaN(Number(targetAmount))) {
    redirect(
      `/categories/${categoryId}/edit?error=${encodeURIComponent("Target amount must be a number.")}`
    );
  }
  if (priority !== null && !PRIORITIES.has(priority as (typeof priorityEnum.enumValues)[number])) {
    redirect(`/categories/${categoryId}/edit?error=${encodeURIComponent("Invalid priority.")}`);
  }

  await db
    .update(categories)
    .set({
      targetAmount,
      priority: priority as (typeof priorityEnum.enumValues)[number] | null,
    })
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));

  redirect("/categories");
}
