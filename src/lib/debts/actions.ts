"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { debts } from "@/db/schema";
import { verifySession } from "@/lib/auth/dal";

export async function updateDebt(formData: FormData): Promise<void> {
  const { userId } = await verifySession();

  const debtId = String(formData.get("debtId") ?? "");
  const startingBalance = String(formData.get("startingBalance") ?? "").trim();
  const minimumPaymentRaw = String(formData.get("minimumPayment") ?? "").trim();
  const aprRaw = String(formData.get("apr") ?? "").trim();
  const targetPayoffDateRaw = String(formData.get("targetPayoffDate") ?? "").trim();

  if (!startingBalance || Number.isNaN(Number(startingBalance)) || Number(startingBalance) < 0) {
    redirect(
      `/debts/${debtId}/edit?error=${encodeURIComponent("Starting balance must be a non-negative number.")}`
    );
  }
  if (minimumPaymentRaw && Number.isNaN(Number(minimumPaymentRaw))) {
    redirect(`/debts/${debtId}/edit?error=${encodeURIComponent("Minimum payment must be a number.")}`);
  }
  if (aprRaw && Number.isNaN(Number(aprRaw))) {
    redirect(`/debts/${debtId}/edit?error=${encodeURIComponent("APR must be a number.")}`);
  }

  await db
    .update(debts)
    .set({
      startingBalance,
      minimumPayment: minimumPaymentRaw || null,
      apr: aprRaw || null,
      targetPayoffDate: targetPayoffDateRaw || null,
    })
    .where(and(eq(debts.id, debtId), eq(debts.userId, userId)));

  redirect("/debts");
}
