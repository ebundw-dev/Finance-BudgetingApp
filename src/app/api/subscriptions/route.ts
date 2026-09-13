import { requireApiUser } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
import { getSubscriptionCandidates } from "@/lib/subscriptions/queries";

// Runs detection live, same as the web /subscriptions page -- no cron,
// no cached table. See src/lib/subscriptions/detect.ts for the algorithm.
export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const candidates = await getSubscriptionCandidates(auth.userId);
  return apiSuccess(candidates);
}
