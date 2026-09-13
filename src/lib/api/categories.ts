import { and, eq, or } from "drizzle-orm";
import {
  allocationRules,
  categories,
  categoryTypeEnum,
  debts,
  goals,
  priorityEnum,
  targetCadenceEnum,
  targetTypeEnum,
  transactions,
} from "@/db/schema";
import { NotFoundError, ValidationError } from "@/lib/accounting/errors";
import type { Tx } from "@/lib/accounting/engine";

const CATEGORY_TYPES = new Set(categoryTypeEnum.enumValues);
const PRIORITIES = new Set(priorityEnum.enumValues);
const TARGET_TYPES = new Set(targetTypeEnum.enumValues);
const TARGET_CADENCES = new Set(targetCadenceEnum.enumValues);

type CategoryTypeValue = (typeof categoryTypeEnum.enumValues)[number];
type PriorityValue = (typeof priorityEnum.enumValues)[number];
type TargetTypeValue = (typeof targetTypeEnum.enumValues)[number];
type TargetCadenceValue = (typeof targetCadenceEnum.enumValues)[number];

export interface CreateCategoryInput {
  groupId: string;
  name: string;
  categoryType: CategoryTypeValue;
}

// Mirrors src/lib/categories/actions.ts's createCategory exactly --
// groupId + name required, categoryType defaults to "spending" and must
// be a valid enum value. A separate copy, not an extracted shared
// function, so the web app's own action file stays untouched.
export function parseCreateCategoryInput(body: unknown): CreateCategoryInput {
  if (!body || typeof body !== "object") {
    throw new ValidationError("A JSON request body is required.");
  }
  const record = body as Record<string, unknown>;
  const groupId = typeof record.groupId === "string" ? record.groupId.trim() : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const categoryType = typeof record.categoryType === "string" ? record.categoryType : "spending";

  if (!groupId || !name || !CATEGORY_TYPES.has(categoryType as CategoryTypeValue)) {
    throw new ValidationError("Group and name are required.");
  }

  return { groupId, name, categoryType: categoryType as CategoryTypeValue };
}

export async function createCategory(tx: Tx, userId: string, input: CreateCategoryInput) {
  const [category] = await tx
    .insert(categories)
    .values({
      userId,
      groupId: input.groupId,
      name: input.name,
      categoryType: input.categoryType,
      allocatedBalance: "0",
    })
    .returning();
  return category;
}

export interface UpdateCategoryInput {
  name: string;
  targetType: TargetTypeValue | null;
  targetAmount: string | null;
  targetCadence: TargetCadenceValue | null;
  targetDate: string | null;
  priority: PriorityValue | null;
  isArchived: boolean;
}

// Mirrors src/lib/categories/actions.ts's updateCategory exactly: name
// required; priority optional but must be a valid enum value; targetType
// empty clears all three target fields to null, otherwise targetAmount
// is required and positive, targetCadence is accepted only for
// refill_up_to (and stays optional even then), and targetDate is
// required only for by_date. groupId/categoryType are NOT editable here,
// matching web (they're only set at creation).
export function parseUpdateCategoryInput(body: unknown): UpdateCategoryInput {
  if (!body || typeof body !== "object") {
    throw new ValidationError("A JSON request body is required.");
  }
  const record = body as Record<string, unknown>;

  const name = typeof record.name === "string" ? record.name.trim() : "";
  if (!name) {
    throw new ValidationError("Name is required.");
  }

  const priorityRaw = typeof record.priority === "string" ? record.priority.trim() : "";
  const priority = priorityRaw === "" ? null : priorityRaw;
  if (priority !== null && !PRIORITIES.has(priority as PriorityValue)) {
    throw new ValidationError("Invalid priority.");
  }

  const targetTypeRaw = typeof record.targetType === "string" ? record.targetType.trim() : "";
  const targetAmountRaw = typeof record.targetAmount === "string" ? record.targetAmount.trim() : "";
  const targetCadenceRaw = typeof record.targetCadence === "string" ? record.targetCadence.trim() : "";
  const targetDateRaw = typeof record.targetDate === "string" ? record.targetDate.trim() : "";

  let targetType: TargetTypeValue | null = null;
  let targetAmount: string | null = null;
  let targetCadence: TargetCadenceValue | null = null;
  let targetDate: string | null = null;

  if (targetTypeRaw !== "") {
    if (!TARGET_TYPES.has(targetTypeRaw as TargetTypeValue)) {
      throw new ValidationError("Invalid target type.");
    }
    targetType = targetTypeRaw as TargetTypeValue;

    if (targetAmountRaw === "" || Number.isNaN(Number(targetAmountRaw)) || Number(targetAmountRaw) <= 0) {
      throw new ValidationError("A positive target amount is required for a target type.");
    }
    targetAmount = targetAmountRaw;

    if (targetType === "refill_up_to" && targetCadenceRaw !== "") {
      if (!TARGET_CADENCES.has(targetCadenceRaw as TargetCadenceValue)) {
        throw new ValidationError("Invalid cadence.");
      }
      targetCadence = targetCadenceRaw as TargetCadenceValue;
    }

    if (targetType === "by_date") {
      if (targetDateRaw === "") {
        throw new ValidationError("A target date is required for By Date.");
      }
      targetDate = targetDateRaw;
    }
  }

  return {
    name,
    targetType,
    targetAmount,
    targetCadence,
    targetDate,
    priority: priority as PriorityValue | null,
    isArchived: record.isArchived === true,
  };
}

export async function updateCategory(tx: Tx, userId: string, categoryId: string, input: UpdateCategoryInput) {
  const [updated] = await tx
    .update(categories)
    .set(input)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
    .returning();
  if (!updated) throw new NotFoundError("Category not found.");
  return updated;
}

// Mirrors src/lib/categories/actions.ts's deleteCategory exactly: a
// nonzero balance, or any reference (a transaction, a debt's reserve
// category, a goal, or a rule set row), blocks the hard delete --
// archiving (isArchived via updateCategory) is the answer for a
// category that's actually been used.
export async function deleteCategory(tx: Tx, userId: string, categoryId: string) {
  const [category] = await tx
    .select()
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));
  if (!category) {
    throw new NotFoundError("Category not found.");
  }

  if (Number(category.allocatedBalance) !== 0) {
    throw new ValidationError(
      "This category still has a balance -- reallocate it to $0 before deleting, or archive it instead."
    );
  }

  const [txnRef] = await tx
    .select({ id: transactions.id })
    .from(transactions)
    .where(or(eq(transactions.categoryId, categoryId), eq(transactions.relatedCategoryId, categoryId)))
    .limit(1);
  const [debtRef] = await tx.select({ id: debts.id }).from(debts).where(eq(debts.categoryId, categoryId)).limit(1);
  const [goalRef] = await tx.select({ id: goals.id }).from(goals).where(eq(goals.categoryId, categoryId)).limit(1);
  const [ruleRef] = await tx
    .select({ id: allocationRules.id })
    .from(allocationRules)
    .where(eq(allocationRules.categoryId, categoryId))
    .limit(1);

  if (txnRef || debtRef || goalRef || ruleRef) {
    throw new ValidationError(
      "This category has history (transactions, a linked debt, a goal, or a rule set) and can't be deleted -- archive it instead."
    );
  }

  await tx.delete(categories).where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));
  return { id: categoryId, deleted: true };
}
