"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { dismissedSubscriptionCandidates } from "@/db/schema";
import { verifySession } from "@/lib/auth/dal";

// Dismissing a candidate never touches transactions/categories/accounts or
// the accounting engine -- it only records the signature (account +
// category + fuzzy payee) so detectRecurringCandidates excludes it on the
// next page load. onConflictDoNothing makes a repeat dismiss of the same
// signature a no-op instead of a duplicate-key error.
export async function dismissSubscriptionCandidate(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const accountId = String(formData.get("accountId") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const payeeKey = String(formData.get("payeeKey") ?? "").trim();

  if (!accountId || !categoryId || !payeeKey) {
    redirect("/subscriptions");
  }

  await db.insert(dismissedSubscriptionCandidates).values({ userId, accountId, categoryId, payeeKey }).onConflictDoNothing();

  redirect(`/subscriptions?success=${encodeURIComponent("Dismissed.")}`);
}
