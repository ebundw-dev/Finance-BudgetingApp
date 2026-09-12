import { requireApiUser } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
import { listDebts } from "@/lib/debts/queries";

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const debts = await listDebts(auth.userId);
  return apiSuccess(debts);
}
