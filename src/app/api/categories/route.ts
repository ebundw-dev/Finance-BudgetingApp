import { requireApiUser } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
import { listCategoryGroupsWithCategories } from "@/lib/categories/queries";

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const groups = await listCategoryGroupsWithCategories(auth.userId);
  return apiSuccess(groups);
}
