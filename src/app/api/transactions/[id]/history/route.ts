import { requireApiUser } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
import { getTransactionHistory } from "@/lib/transactions/queries";

// Reads transaction_history directly (see that query's own comment for
// why it isn't joined to transactions) -- most recent first.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const history = await getTransactionHistory(auth.userId, id);
  return apiSuccess(history);
}
