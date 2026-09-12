import { db } from "@/db";
import { requireApiUser } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
import { listApiTokensForUser } from "@/lib/auth/apiTokens";

// Lists the calling user's own tokens (never the raw token or its hash --
// see ApiTokenSummary). Bearer-authed like every other route below this
// point; a token can list and revoke its own siblings, which is how a
// lost-phone token gets cut off from another device.
export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const tokens = await db.transaction((tx) => listApiTokensForUser(tx, auth.userId));
  return apiSuccess(tokens);
}
