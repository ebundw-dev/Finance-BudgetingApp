import { db } from "@/db";
import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/lib/api/response";
import { createGoal, parseGoalInput } from "@/lib/api/goals";
import { listGoals } from "@/lib/goals/queries";

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const goals = await listGoals(auth.userId);
  return apiSuccess(goals);
}

// Mirrors src/lib/goals/actions.ts's createGoal Server Action exactly
// (see src/lib/api/goals.ts) -- no parallel validation.
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
    const input = parseGoalInput(body);
    const goal = await db.transaction((tx) => createGoal(tx, auth.userId, input));
    return apiSuccess(goal, 201);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
