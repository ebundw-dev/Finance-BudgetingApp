import { requireApiUser } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
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
