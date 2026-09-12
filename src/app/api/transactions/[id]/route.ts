import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getTransaction } from "@/lib/transactions/queries";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const txn = await getTransaction(auth.userId, id);
  if (!txn) return apiError("Transaction not found.", 404);

  return apiSuccess(txn);
}
