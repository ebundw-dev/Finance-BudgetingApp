import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { scheduledTransactions } from "@/db/schema";
import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/response";
import { computeNextDueDate } from "@/lib/scheduled/cadence";
import { getScheduledTransaction } from "@/lib/scheduled/queries";

// Advances nextDueDate without posting anything -- no accounting engine
// call, mirroring skipScheduledTransaction exactly.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const scheduled = await getScheduledTransaction(auth.userId, id);
  if (!scheduled) return apiError("Scheduled transaction not found.", 404);

  const nextDueDate = computeNextDueDate(scheduled.nextDueDate, scheduled.cadence, scheduled.intervalDays);
  await db
    .update(scheduledTransactions)
    .set({ nextDueDate })
    .where(and(eq(scheduledTransactions.id, id), eq(scheduledTransactions.userId, auth.userId)));

  return apiSuccess({ id, skipped: true, nextDueDate });
}
