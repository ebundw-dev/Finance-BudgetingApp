import { db } from "@/db";
import { deleteTransaction } from "@/lib/accounting/engine";
import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/lib/api/response";
import { parseUpdateTransactionInput, updateTransaction } from "@/lib/api/transactions";
import { getTransaction } from "@/lib/transactions/queries";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const txn = await getTransaction(auth.userId, id);
  if (!txn) return apiError("Transaction not found.", 404);

  return apiSuccess(txn);
}

// Wired to updateExpense for a plain (non-split) expense, or
// updateSplitExpense for a split one -- see parseUpdateTransactionInput
// in src/lib/api/transactions.ts for how the body's shape picks between
// them. Account/type are immutable; only a category/amount/date/notes
// correction is supported here, same as both engine functions allow.
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
    const input = parseUpdateTransactionInput(body);
    const txn = await db.transaction((tx) => updateTransaction(tx, auth.userId, id, input));
    return apiSuccess(txn);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

// Reverses and removes any transaction type via the engine's
// deleteTransaction -- no web equivalent exists to mirror (see
// src/lib/accounting/engine.ts's deleteTransaction comment), so this
// calls the engine function directly rather than through a
// src/lib/api/ copy.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;

  try {
    const result = await db.transaction((tx) => deleteTransaction(tx, auth.userId, id));
    return apiSuccess(result);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
