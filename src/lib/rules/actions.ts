"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { allocationRules } from "@/db/schema";
import { percentagesSumTo100 } from "@/lib/accounting/allocationRules";
import { verifySession } from "@/lib/auth/dal";
import { listRuleSetNames } from "./queries";

export interface CreateRuleSetState {
  error?: string;
}

// Returns the next state rather than redirecting on a validation failure,
// so RuleSetForm's plain onSubmit handler can show the error in place --
// a redirect is a real navigation that would remount the form and wipe
// every category/percentage the user had already entered. Only the
// success path navigates away, via redirect(), since there's nothing left
// on the page to preserve at that point. Called directly (not via
// useActionState + <form action>) -- see RuleSetForm.tsx for why.
export async function createRuleSet(
  _prevState: CreateRuleSetState,
  formData: FormData
): Promise<CreateRuleSetState> {
  const { userId } = await verifySession();

  const ruleName = String(formData.get("ruleName") ?? "").trim();
  const categoryIds = formData.getAll("categoryId[]").map(String);
  const percentages = formData.getAll("percentage[]").map(String);

  const rows = categoryIds
    .map((categoryId, i) => ({ categoryId: categoryId.trim(), percentage: percentages[i]?.trim() ?? "" }))
    .filter((row) => row.categoryId !== "" && row.percentage !== "" && Number(row.percentage) > 0);

  if (!ruleName) {
    return { error: "Name is required." };
  }
  if (rows.length < 2) {
    return { error: "Add at least two categories." };
  }
  if (!percentagesSumTo100(rows)) {
    const sum = Math.round(rows.reduce((acc, row) => acc + Number(row.percentage), 0) * 100) / 100;
    const diff = Math.round((100 - sum) * 100) / 100;
    const adjustment = diff > 0 ? `add ${diff}% more` : `remove ${Math.abs(diff)}%`;
    return { error: `Percentages must sum to 100 -- currently at ${sum}%, ${adjustment}.` };
  }

  const existingNames = await listRuleSetNames(userId);
  if (existingNames.some((name) => name.toLowerCase() === ruleName.toLowerCase())) {
    return { error: "A rule set with that name already exists." };
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
