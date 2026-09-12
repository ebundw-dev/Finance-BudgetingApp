import { requireApiUser } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
import { listAccounts } from "@/lib/accounts/queries";

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const accounts = await listAccounts(auth.userId);
  return apiSuccess(accounts);
}
