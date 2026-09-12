import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getAccount } from "@/lib/accounts/queries";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const account = await getAccount(auth.userId, id);
  if (!account) return apiError("Account not found.", 404);

  return apiSuccess(account);
}
