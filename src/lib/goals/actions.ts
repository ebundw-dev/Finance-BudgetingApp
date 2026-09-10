"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { goals } from "@/db/schema";
import { verifySession } from "@/lib/auth/dal";

function parseTargetAmount(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || Number.isNaN(Number(trimmed)) || Number(trimmed) <= 0) return null;
  return trimmed;
}

export async function createGoal(formData: FormData): Promise<void> {
  const { userId } = await verifySession();

  const name = String(formData.get("name") ?? "").trim();
  const targetAmount = parseTargetAmount(String(formData.get("targetAmount") ?? ""));
  const targetDate = String(formData.get("targetDate") ?? "").trim() || null;
  const categoryId = String(formData.get("categoryId") ?? "").trim() || null;

  if (!name || !targetAmount) {
    redirect(
      `/goals/new?error=${encodeURIComponent("Name and a positive target amount are required.")}`
    );
  }

  await db.insert(goals).values({ userId, name, targetAmount, targetDate, categoryId });

  redirect("/goals");
}

export async function updateGoal(formData: FormData): Promise<void> {
  const { userId } = await verifySession();

  const goalId = String(formData.get("goalId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const targetAmount = parseTargetAmount(String(formData.get("targetAmount") ?? ""));
  const targetDate = String(formData.get("targetDate") ?? "").trim() || null;
  const categoryId = String(formData.get("categoryId") ?? "").trim() || null;

  if (!name || !targetAmount) {
    redirect(
      `/goals/${goalId}/edit?error=${encodeURIComponent("Name and a positive target amount are required.")}`
    );
  }

  await db
    .update(goals)
    .set({ name, targetAmount, targetDate, categoryId })
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)));

  redirect("/goals");
}

export async function deleteGoal(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const goalId = String(formData.get("goalId") ?? "");

  await db.delete(goals).where(and(eq(goals.id, goalId), eq(goals.userId, userId)));

  redirect("/goals");
}
