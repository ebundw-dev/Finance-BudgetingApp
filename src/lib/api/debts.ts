import { and, eq } from "drizzle-orm";
import { debts } from "@/db/schema";
import { NotFoundError, ValidationError } from "@/lib/accounting/errors";
import type { Tx } from "@/lib/accounting/engine";

export interface UpdateDebtInput {
  startingBalance: string;
  minimumPayment: string | null;
  apr: string | null;
  targetPayoffDate: string | null;
}

// Mirrors src/lib/debts/actions.ts's updateDebt Server Action exactly
// (startingBalance required and non-negative; minimumPayment/apr
// optional but must be numeric if present; targetPayoffDate optional
// and NOT otherwise validated, matching web) -- a separate copy, not an
// extracted shared function, so the web app's own action file stays
// untouched. Note there is no createDebt to mirror here: debts are only
// ever created via account creation's "track as debt" flag (see
// src/lib/api/accounts.ts).
export function parseUpdateDebtInput(body: unknown): UpdateDebtInput {
  if (!body || typeof body !== "object") {
    throw new ValidationError("A JSON request body is required.");
  }
  const record = body as Record<string, unknown>;

  const startingBalanceRaw = typeof record.startingBalance === "string" ? record.startingBalance.trim() : "";
  if (!startingBalanceRaw || Number.isNaN(Number(startingBalanceRaw)) || Number(startingBalanceRaw) < 0) {
    throw new ValidationError("Starting balance must be a non-negative number.");
  }

  const minimumPaymentRaw = typeof record.minimumPayment === "string" ? record.minimumPayment.trim() : "";
  if (minimumPaymentRaw && Number.isNaN(Number(minimumPaymentRaw))) {
    throw new ValidationError("Minimum payment must be a number.");
  }

  const aprRaw = typeof record.apr === "string" ? record.apr.trim() : "";
  if (aprRaw && Number.isNaN(Number(aprRaw))) {
    throw new ValidationError("APR must be a number.");
  }

  const targetPayoffDateRaw = typeof record.targetPayoffDate === "string" ? record.targetPayoffDate.trim() : "";

  return {
    startingBalance: startingBalanceRaw,
    minimumPayment: minimumPaymentRaw || null,
    apr: aprRaw || null,
    targetPayoffDate: targetPayoffDateRaw || null,
  };
}

export async function updateDebt(tx: Tx, userId: string, debtId: string, input: UpdateDebtInput) {
  const [updated] = await tx
    .update(debts)
    .set(input)
    .where(and(eq(debts.id, debtId), eq(debts.userId, userId)))
    .returning();
  if (!updated) throw new NotFoundError("Debt not found.");
  return updated;
}
