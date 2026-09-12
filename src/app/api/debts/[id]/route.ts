import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getDebt } from "@/lib/debts/queries";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const debt = await getDebt(auth.userId, id);
  if (!debt) return apiError("Debt not found.", 404);

  return apiSuccess(debt);
}
