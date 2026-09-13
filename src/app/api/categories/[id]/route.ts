import { db } from "@/db";
import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/lib/api/response";
import { deleteCategory, parseUpdateCategoryInput, updateCategory } from "@/lib/api/categories";
import { getCategory } from "@/lib/categories/queries";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const category = await getCategory(auth.userId, id);
  if (!category) return apiError("Category not found.", 404);

  return apiSuccess(category);
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
    const input = parseUpdateCategoryInput(body);
    const category = await db.transaction((tx) => updateCategory(tx, auth.userId, id, input));
    return apiSuccess(category);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;

  try {
    const result = await db.transaction((tx) => deleteCategory(tx, auth.userId, id));
    return apiSuccess(result);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
