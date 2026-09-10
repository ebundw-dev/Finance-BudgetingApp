import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, goals } from "@/db/schema";

export interface GoalRow {
  id: string;
  name: string;
  targetAmount: string;
  targetDate: string | null;
  categoryId: string | null;
  categoryName: string | null;
  allocatedBalance: string | null;
}

export async function listGoals(userId: string): Promise<GoalRow[]> {
  return db
    .select({
      id: goals.id,
      name: goals.name,
      targetAmount: goals.targetAmount,
      targetDate: goals.targetDate,
      categoryId: goals.categoryId,
      categoryName: categories.name,
      allocatedBalance: categories.allocatedBalance,
    })
    .from(goals)
    .leftJoin(categories, eq(goals.categoryId, categories.id))
    .where(eq(goals.userId, userId))
    .orderBy(goals.targetDate);
}

export async function getGoal(userId: string, goalId: string) {
  const [goal] = await db
    .select()
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)));
  return goal;
}
