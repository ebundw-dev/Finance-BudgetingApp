import { dismissedSubscriptionCandidates } from "@/db/schema";
import { ValidationError } from "@/lib/accounting/errors";
import type { Tx } from "@/lib/accounting/engine";

export interface DismissCandidateInput {
  accountId: string;
  categoryId: string;
  payeeKey: string;
}

// Mirrors src/lib/subscriptions/actions.ts's dismissSubscriptionCandidate
// exactly: accountId/categoryId/payeeKey required -- a separate copy, not
// an extracted shared function, so the web app's own action file stays
// untouched.
export function parseDismissCandidateInput(body: unknown): DismissCandidateInput {
  if (!body || typeof body !== "object") {
    throw new ValidationError("A JSON request body is required.");
  }
  const record = body as Record<string, unknown>;
  const accountId = typeof record.accountId === "string" ? record.accountId.trim() : "";
  const categoryId = typeof record.categoryId === "string" ? record.categoryId.trim() : "";
  const payeeKey = typeof record.payeeKey === "string" ? record.payeeKey.trim() : "";

  if (!accountId || !categoryId || !payeeKey) {
    throw new ValidationError("accountId, categoryId, and payeeKey are required.");
  }

  return { accountId, categoryId, payeeKey };
}

// Records the dismissal signature (account + category + fuzzy payee) so
// detectRecurringCandidates excludes it on the next read -- never touches
// transactions/categories/accounts or the accounting engine.
// onConflictDoNothing makes a repeat dismiss of the same signature a
// no-op instead of a duplicate-key error, same as the web action.
export async function dismissCandidate(tx: Tx, userId: string, input: DismissCandidateInput) {
  await tx.insert(dismissedSubscriptionCandidates).values({ userId, ...input }).onConflictDoNothing();
  return { dismissed: true };
}
