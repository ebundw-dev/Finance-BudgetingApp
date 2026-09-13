import { db } from "@/db";
import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/lib/api/response";
import { parseGoalInput, updateGoal } from "@/lib/api/goals";
import { getGoal } from "@/lib/goals/queries";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const goal = await getGoal(auth.userId, id);
  if (!goal) return apiError("Goal not found.", 404);

  return apiSuccess(goal);
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
    const input = parseGoalInput(body);
    const goal = await db.transaction((tx) => updateGoal(tx, auth.userId, id, input));
    return apiSuccess(goal);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
