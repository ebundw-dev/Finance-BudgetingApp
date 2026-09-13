import { db } from "@/db";
import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/lib/api/response";
import { createCategory, parseCreateCategoryInput } from "@/lib/api/categories";
import { listCategoryGroupsWithCategories } from "@/lib/categories/queries";

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const groups = await listCategoryGroupsWithCategories(auth.userId);
  return apiSuccess(groups);
}

// Mirrors src/lib/categories/actions.ts's createCategory Server Action
// exactly (see src/lib/api/categories.ts) -- no parallel validation.
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
    const input = parseCreateCategoryInput(body);
    const category = await db.transaction((tx) => createCategory(tx, auth.userId, input));
    return apiSuccess(category, 201);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
