import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { scheduledTransactions } from "@/db/schema";
import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/lib/api/response";
import { computeNextDueDate } from "@/lib/scheduled/cadence";
import { postScheduled } from "@/lib/scheduled/post";
import { getScheduledTransaction } from "@/lib/scheduled/queries";

// Posts the scheduled transaction as a real one (via the same engine
// function a manual entry would use, see postScheduled) and advances
// nextDueDate atomically -- if the accounting engine rejects it, the
// whole transaction rolls back and nextDueDate does not move, exactly
// mirroring src/lib/scheduled/actions.ts's confirmScheduledTransaction,
// just returning JSON instead of redirecting.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const scheduled = await getScheduledTransaction(auth.userId, id);
  if (!scheduled) return apiError("Scheduled transaction not found.", 404);

  let body: unknown = {};
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return apiError("Invalid JSON body.", 400);
  }
  const amountOverride = (body as { amount?: unknown }).amount;
  const amount = typeof amountOverride === "string" && amountOverride.trim() ? amountOverride : scheduled.amount;

  if (Number.isNaN(Number(amount)) || Number(amount) <= 0) {
    return apiError("Amount must be a positive number.", 400);
  }

  try {
    await db.transaction(async (tx) => {
      await postScheduled(tx, auth.userId, scheduled, amount);
      const nextDueDate = computeNextDueDate(scheduled.nextDueDate, scheduled.cadence, scheduled.intervalDays);
      await tx
        .update(scheduledTransactions)
        .set({ nextDueDate })
        .where(and(eq(scheduledTransactions.id, id), eq(scheduledTransactions.userId, auth.userId)));
    });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }

  return apiSuccess({ id, posted: true });
}
