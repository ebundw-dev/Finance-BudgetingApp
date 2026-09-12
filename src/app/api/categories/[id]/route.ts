import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getCategory } from "@/lib/categories/queries";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const category = await getCategory(auth.userId, id);
  if (!category) return apiError("Category not found.", 404);

  return apiSuccess(category);
}
