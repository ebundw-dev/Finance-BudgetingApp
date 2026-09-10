"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { allocationRules } from "@/db/schema";
import { percentagesSumTo100 } from "@/lib/accounting/allocationRules";
import { verifySession } from "@/lib/auth/dal";
import { listRuleSetNames } from "./queries";

export async function createRuleSet(formData: FormData): Promise<void> {
  const { userId } = await verifySession();

  const ruleName = String(formData.get("ruleName") ?? "").trim();
  const categoryIds = formData.getAll("categoryId[]").map(String);
  const percentages = formData.getAll("percentage[]").map(String);

  const rows = categoryIds
    .map((categoryId, i) => ({ categoryId: categoryId.trim(), percentage: percentages[i]?.trim() ?? "" }))
    .filter((row) => row.categoryId !== "" && row.percentage !== "" && Number(row.percentage) > 0);

  if (!ruleName) {
    redirect(`/rules/new?error=${encodeURIComponent("Name is required.")}`);
  }
  if (rows.length < 2) {
    redirect(`/rules/new?error=${encodeURIComponent("Add at least two categories.")}`);
  }
  if (!percentagesSumTo100(rows)) {
    redirect(`/rules/new?error=${encodeURIComponent("Percentages must sum to exactly 100.")}`);
  }

  const existingNames = await listRuleSetNames(userId);
  if (existingNames.some((name) => name.toLowerCase() === ruleName.toLowerCase())) {
    redirect(`/rules/new?error=${encodeURIComponent("A rule set with that name already exists.")}`);
  }

  await db.insert(allocationRules).values(
    rows.map((row, i) => ({
      userId,
      ruleName,
      categoryId: row.categoryId,
      percentage: row.percentage,
      sortOrder: i,
    }))
  );

  redirect("/rules");
}

export async function deleteRuleSet(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const ruleName = String(formData.get("ruleName") ?? "");

  await db
    .delete(allocationRules)
    .where(and(eq(allocationRules.userId, userId), eq(allocationRules.ruleName, ruleName)));

  redirect("/rules");
}
