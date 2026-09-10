"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { computeRuleSetSplit } from "@/lib/accounting/allocationRules";
import { AccountingError } from "@/lib/accounting/errors";
import { recordBulkAllocation, recordIncome } from "@/lib/accounting/engine";
import { verifySession } from "@/lib/auth/dal";
import { getRuleSet } from "@/lib/rules/queries";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function allocateAction(formData: FormData): Promise<void> {
  const { userId } = await verifySession();

  const categoryIds = formData.getAll("categoryId[]").map(String);
  const amounts = formData.getAll("amount[]").map(String);
  const items = categoryIds.map((categoryId, i) => ({
    categoryId,
    amount: amounts[i]?.trim() || "0",
  }));

  const redirectBase = formData.get("priority") === "1" ? "/allocate?priority=1" : "/allocate";

  try {
    await db.transaction((tx) => recordBulkAllocation(tx, userId, items, { date: today() }));
  } catch (error) {
    if (error instanceof AccountingError) {
      const sep = redirectBase.includes("?") ? "&" : "?";
      redirect(`${redirectBase}${sep}error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  redirect("/transactions");
}

export async function applyRuleSetAction(formData: FormData): Promise<void> {
  const { userId } = await verifySession();

  const ruleName = String(formData.get("ruleName") ?? "");
  const amount = String(formData.get("amount") ?? "").trim();

  if (!ruleName || !amount || Number(amount) <= 0) {
    redirect(`/allocate/auto?error=${encodeURIComponent("Pick a rule set and enter an amount.")}`);
  }

  const rows = await getRuleSet(userId, ruleName);
  if (rows.length === 0) {
    redirect(`/allocate/auto?error=${encodeURIComponent("That rule set has no rows.")}`);
  }

  const items = computeRuleSetSplit(rows, amount);

  try {
    await db.transaction((tx) => recordBulkAllocation(tx, userId, items, { date: today() }));
  } catch (error) {
    if (error instanceof AccountingError) {
      redirect(`/allocate/auto?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  redirect("/transactions");
}

export async function quickPayoutAction(formData: FormData): Promise<void> {
  const { userId } = await verifySession();

  const accountId = String(formData.get("accountId") ?? "");
  const amount = String(formData.get("amount") ?? "").trim();
  const source = String(formData.get("source") ?? "").trim() || undefined;

  try {
    await db.transaction((tx) =>
      recordIncome(tx, userId, { accountId, amount, date: today(), source })
    );
  } catch (error) {
    if (error instanceof AccountingError) {
      redirect(`/allocate/quick?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  redirect("/allocate?priority=1");
}
