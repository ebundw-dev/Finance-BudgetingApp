import { db } from "@/db";
import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/lib/api/response";
import { parseUpdateAccountInput, updateAccount } from "@/lib/api/accounts";
import { getAccount } from "@/lib/accounts/queries";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const account = await getAccount(auth.userId, id);
  if (!account) return apiError("Account not found.", 404);

  return apiSuccess(account);
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
    const input = parseUpdateAccountInput(body);
    const account = await db.transaction((tx) => updateAccount(tx, auth.userId, id, input));
    return apiSuccess(account);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
