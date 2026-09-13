import { db } from "@/db";
import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/lib/api/response";
import { dismissCandidate, parseDismissCandidateInput } from "@/lib/api/subscriptions";

// Mirrors src/lib/subscriptions/actions.ts's dismissSubscriptionCandidate
// Server Action exactly (see src/lib/api/subscriptions.ts) -- no parallel
// validation. A POST rather than DELETE since there's no existing
// resource id to address -- a dismissal is itself the record being
// created (or a no-op if the signature is already dismissed).
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
    const input = parseDismissCandidateInput(body);
    const result = await db.transaction((tx) => dismissCandidate(tx, auth.userId, input));
    return apiSuccess(result);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
