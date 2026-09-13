import { db } from "@/db";
import { recordReconciliation } from "@/lib/accounting/engine";
import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/lib/api/response";
import { parseReconcileInput } from "@/lib/api/accounts";

// Calls recordReconciliation (src/lib/accounting/engine.ts) directly --
// same engine function src/lib/accounts/actions.ts's reconcileAccount
// Server Action calls, only the JSON-vs-FormData parsing differs (see
// src/lib/api/accounts.ts's parseReconcileInput).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const input = parseReconcileInput(body);
    const result = await db.transaction((tx) => recordReconciliation(tx, auth.userId, { accountId: id, ...input }));
    return apiSuccess(result);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
