import { db } from "@/db";
import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/lib/api/response";
import { createAccount, parseCreateAccountInput } from "@/lib/api/accounts";
import { listAccounts } from "@/lib/accounts/queries";

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const accounts = await listAccounts(auth.userId);
  return apiSuccess(accounts);
}

// Creates an account through the exact same validation and "track as
// debt" reserve-category setup as the web app's createAccount Server
// Action (see src/lib/api/accounts.ts) -- no parallel logic.
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
    const input = parseCreateAccountInput(body);
    const account = await db.transaction((tx) => createAccount(tx, auth.userId, input));
    return apiSuccess(account, 201);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
