import { and, eq } from "drizzle-orm";
import { goals } from "@/db/schema";
import { NotFoundError, ValidationError } from "@/lib/accounting/errors";
import type { Tx } from "@/lib/accounting/engine";

export interface GoalInput {
  name: string;
  targetAmount: string;
  targetDate: string | null;
  categoryId: string | null;
}

function parseTargetAmount(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || Number.isNaN(Number(trimmed)) || Number(trimmed) <= 0) return null;
  return trimmed;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// Mirrors src/lib/goals/actions.ts's createGoal/updateGoal validation
// exactly (name + positive targetAmount required; targetDate/categoryId
// optional, targetDate not otherwise validated, categoryId not checked
// for existence here -- same as web) -- a separate copy, not an
// extracted shared function, so the web app's action file stays
// untouched.
export function parseGoalInput(body: unknown): GoalInput {
  if (!body || typeof body !== "object") {
    throw new ValidationError("A JSON request body is required.");
  }
  const record = body as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const targetAmount = parseTargetAmount(record.targetAmount);
  if (!name || !targetAmount) {
    throw new ValidationError("Name and a positive target amount are required.");
  }
  return {
    name,
    targetAmount,
    targetDate: optionalString(record.targetDate),
    categoryId: optionalString(record.categoryId),
  };
}

export async function createGoal(tx: Tx, userId: string, input: GoalInput) {
  const [goal] = await tx.insert(goals).values({ userId, ...input }).returning();
  return goal;
}

export async function updateGoal(tx: Tx, userId: string, goalId: string, input: GoalInput) {
  const [updated] = await tx
    .update(goals)
    .set({
      name: input.name,
      targetAmount: input.targetAmount,
      targetDate: input.targetDate,
      categoryId: input.categoryId,
    })
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .returning();
  if (!updated) throw new NotFoundError("Goal not found.");
  return updated;
}
