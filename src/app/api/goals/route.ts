import { requireApiUser } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
import { listGoals } from "@/lib/goals/queries";

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const goals = await listGoals(auth.userId);
  return apiSuccess(goals);
}
