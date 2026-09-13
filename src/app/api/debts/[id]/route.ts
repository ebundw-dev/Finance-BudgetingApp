import { db } from "@/db";
import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/lib/api/response";
import { parseUpdateDebtInput, updateDebt } from "@/lib/api/debts";
import { getDebt } from "@/lib/debts/queries";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const debt = await getDebt(auth.userId, id);
  if (!debt) return apiError("Debt not found.", 404);

  return apiSuccess(debt);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body.", 400);
  }

  try {
    const input = parseUpdateDebtInput(body);
    await db.transaction((tx) => updateDebt(tx, auth.userId, id, input));
    // Re-fetch the joined shape (accountName/categoryName/reservedBalance)
    // rather than returning the raw updated debts row -- see GET above and
    // src/lib/debts/queries.ts's getDebt, which mobile relies on for the
    // full DebtRow shape.
    const debt = await getDebt(auth.userId, id);
    return apiSuccess(debt);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
