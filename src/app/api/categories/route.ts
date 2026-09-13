import { db } from "@/db";
import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/lib/api/response";
import { createCategory, parseCreateCategoryInput } from "@/lib/api/categories";
import { getAllocatedThisMonthByCategory, listCategoryGroupsWithCategories } from "@/lib/categories/queries";

// allocatedThisMonth is merged in here (not part of
// listCategoryGroupsWithCategories's own shape, which the web Categories
// page also calls directly and fetches this separately -- see
// src/app/(app)/categories/page.tsx) so mobile's category list can drive
// the same set_aside_monthly/by_date funding-status logic
// (mobile/lib/categoryTargets.ts) with a single request.
export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const [groups, allocatedThisMonth] = await Promise.all([
    listCategoryGroupsWithCategories(auth.userId),
    getAllocatedThisMonthByCategory(auth.userId),
  ]);

  const withAllocatedThisMonth = groups.map((group) => ({
    ...group,
    categories: group.categories.map((category) => ({
      ...category,
      allocatedThisMonth: allocatedThisMonth[category.id] ?? "0",
    })),
  }));

  return apiSuccess(withAllocatedThisMonth);
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
