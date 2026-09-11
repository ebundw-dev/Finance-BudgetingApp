"use server";

import { and, eq, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  allocationRules,
  categories,
  categoryGroups,
  categoryTypeEnum,
  debts,
  goals,
  priorityEnum,
  targetCadenceEnum,
  targetTypeEnum,
  transactions,
} from "@/db/schema";
import { verifySession } from "@/lib/auth/dal";

const CATEGORY_TYPES = new Set(categoryTypeEnum.enumValues);
const PRIORITIES = new Set(priorityEnum.enumValues);
const TARGET_TYPES = new Set(targetTypeEnum.enumValues);
const TARGET_CADENCES = new Set(targetCadenceEnum.enumValues);

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
  const name = String(formData.get("name") ?? "").trim();
  const targetTypeRaw = String(formData.get("targetType") ?? "").trim();
  const targetAmountRaw = String(formData.get("targetAmount") ?? "").trim();
  const targetCadenceRaw = String(formData.get("targetCadence") ?? "").trim();
  const targetDateRaw = String(formData.get("targetDate") ?? "").trim();
  const priorityRaw = String(formData.get("priority") ?? "").trim();
  const isArchived = formData.get("isArchived") === "on";

  const priority = priorityRaw === "" ? null : priorityRaw;

  if (!name) {
    redirect(`/categories/${categoryId}/edit?error=${encodeURIComponent("Name is required.")}`);
  }
  if (priority !== null && !PRIORITIES.has(priority as (typeof priorityEnum.enumValues)[number])) {
    redirect(`/categories/${categoryId}/edit?error=${encodeURIComponent("Invalid priority.")}`);
  }

  // targetType drives which of targetAmount/targetCadence/targetDate are
  // relevant -- see the categories table comment in schema.ts. The other
  // fields are cleared to null rather than left with stale values from a
  // previously-selected type.
  let targetType: (typeof targetTypeEnum.enumValues)[number] | null = null;
  let targetAmount: string | null = null;
  let targetCadence: (typeof targetCadenceEnum.enumValues)[number] | null = null;
  let targetDate: string | null = null;

  if (targetTypeRaw !== "") {
    if (!TARGET_TYPES.has(targetTypeRaw as (typeof targetTypeEnum.enumValues)[number])) {
      redirect(`/categories/${categoryId}/edit?error=${encodeURIComponent("Invalid target type.")}`);
    }
    targetType = targetTypeRaw as (typeof targetTypeEnum.enumValues)[number];

    if (targetAmountRaw === "" || Number.isNaN(Number(targetAmountRaw)) || Number(targetAmountRaw) <= 0) {
      redirect(
        `/categories/${categoryId}/edit?error=${encodeURIComponent(
          "A positive target amount is required for a target type."
        )}`
      );
    }
    targetAmount = targetAmountRaw;

    if (targetType === "refill_up_to" && targetCadenceRaw !== "") {
      if (!TARGET_CADENCES.has(targetCadenceRaw as (typeof targetCadenceEnum.enumValues)[number])) {
        redirect(`/categories/${categoryId}/edit?error=${encodeURIComponent("Invalid cadence.")}`);
      }
      targetCadence = targetCadenceRaw as (typeof targetCadenceEnum.enumValues)[number];
    }

    if (targetType === "by_date") {
      if (targetDateRaw === "") {
        redirect(
          `/categories/${categoryId}/edit?error=${encodeURIComponent("A target date is required for By Date.")}`
        );
      }
      targetDate = targetDateRaw;
    }
  }

  await db
    .update(categories)
    .set({
      name,
      targetType,
      targetAmount,
      targetCadence,
      targetDate,
      priority: priority as (typeof priorityEnum.enumValues)[number] | null,
      isArchived,
    })
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));

  redirect("/categories");
}

// Hard delete is only safe for a category nobody has ever used: a nonzero
// balance would need to go somewhere (Unallocated Cash or another
// category) to keep the core equation intact, and any existing reference
// (a transaction, a debt's reserve category, a goal, a rule set row) would
// either orphan history or hit the DB's FK constraint. Archiving (see
// updateCategory) is the answer for a category that's actually been used;
// this is for cleaning up one created by mistake.
export async function deleteCategory(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const categoryId = String(formData.get("categoryId") ?? "");

  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));
  if (!category) {
    redirect("/categories");
  }

  if (Number(category.allocatedBalance) !== 0) {
    redirect(
      `/categories/${categoryId}/edit?error=${encodeURIComponent(
        "This category still has a balance -- reallocate it to $0 before deleting, or archive it instead."
      )}`
    );
  }

  const [txnRef] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(or(eq(transactions.categoryId, categoryId), eq(transactions.relatedCategoryId, categoryId)))
    .limit(1);
  const [debtRef] = await db.select({ id: debts.id }).from(debts).where(eq(debts.categoryId, categoryId)).limit(1);
  const [goalRef] = await db.select({ id: goals.id }).from(goals).where(eq(goals.categoryId, categoryId)).limit(1);
  const [ruleRef] = await db
    .select({ id: allocationRules.id })
    .from(allocationRules)
    .where(eq(allocationRules.categoryId, categoryId))
    .limit(1);

  if (txnRef || debtRef || goalRef || ruleRef) {
    redirect(
      `/categories/${categoryId}/edit?error=${encodeURIComponent(
        "This category has history (transactions, a linked debt, a goal, or a rule set) and can't be deleted -- archive it instead."
      )}`
    );
  }

  await db.delete(categories).where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));

  redirect("/categories");
}
