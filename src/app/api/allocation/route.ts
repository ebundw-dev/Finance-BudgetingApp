import { db } from "@/db";
import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/lib/api/response";
import { parseSubmitAllocationInput, submitAllocation } from "@/lib/api/allocation";
import { getUnallocatedCash } from "@/lib/allocation/queries";
import { listCategories } from "@/lib/categories/queries";

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const [unallocatedCash, categories] = await Promise.all([
    getUnallocatedCash(auth.userId),
    listCategories(auth.userId),
  ]);

  return apiSuccess({ unallocatedCash, categories });
}

// Submits a lump sum split across categories through the same
// recordBulkAllocation the web Allocate form (and Auto-Allocate, and
// Quick Payout Allocation) already use -- see src/lib/api/allocation.ts.
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
    const input = parseSubmitAllocationInput(body);
    const txns = await db.transaction((tx) => submitAllocation(tx, auth.userId, input));
    return apiSuccess(txns, 201);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
