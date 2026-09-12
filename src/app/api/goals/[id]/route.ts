import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getGoal } from "@/lib/goals/queries";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const goal = await getGoal(auth.userId, id);
  if (!goal) return apiError("Goal not found.", 404);

  return apiSuccess(goal);
}
