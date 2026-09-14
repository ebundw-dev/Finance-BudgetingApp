import { db } from "@/db";
import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/lib/api/response";
import { createTransaction, parseCreateTransactionInput } from "@/lib/api/transactions";
import { listTransactionsPaginated } from "@/lib/transactions/queries";

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId") ?? undefined;
  const categoryId = url.searchParams.get("categoryId") ?? undefined;
  const dateFrom = url.searchParams.get("dateFrom") ?? undefined;
  const dateTo = url.searchParams.get("dateTo") ?? undefined;
  const search = url.searchParams.get("search") ?? undefined;
  const amountMin = url.searchParams.get("amountMin") ?? undefined;
  const amountMax = url.searchParams.get("amountMax") ?? undefined;
  const limit = url.searchParams.get("limit");
  const offset = url.searchParams.get("offset");

  const result = await listTransactionsPaginated(auth.userId, {
    accountId,
    categoryId,
    dateFrom,
    dateTo,
    search,
    amountMin,
    amountMax,
    limit: limit ? Number(limit) : undefined,
    offset: offset ? Number(offset) : undefined,
  });

  return apiSuccess(result);
}

// Posts a new expense/income/transfer/split_expense through the exact
// same accounting engine functions the web forms use (see
// src/lib/api/transactions.ts) -- no parallel posting path.
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
    const input = parseCreateTransactionInput(body);
    const txn = await db.transaction((tx) => createTransaction(tx, auth.userId, input));
    return apiSuccess(txn, 201);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
