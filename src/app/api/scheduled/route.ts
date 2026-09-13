import { db } from "@/db";
import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/lib/api/response";
import { createScheduled, parseCreateScheduledInput } from "@/lib/api/scheduled";
import { listDueScheduledTransactions, listUpcomingScheduledTransactions } from "@/lib/scheduled/queries";

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const [due, upcoming] = await Promise.all([
    listDueScheduledTransactions(auth.userId),
    listUpcomingScheduledTransactions(auth.userId),
  ]);

  return apiSuccess({ due, upcoming });
}

// Mirrors src/lib/scheduled/actions.ts's createScheduledTransaction Server
// Action exactly (see src/lib/api/scheduled.ts) -- no parallel validation.
// Used both as a general "create a scheduled transaction" capability and
// by the mobile Subscriptions screen's "Track it" button (type "expense",
// pre-filled from a detected candidate).
export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body.", 400);
  }

  try {
    const input = parseCreateScheduledInput(body);
    const scheduled = await db.transaction((tx) => createScheduled(tx, auth.userId, input));
    return apiSuccess(scheduled, 201);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
