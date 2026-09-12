import { db } from "@/db";
import { type ApiAuthSession, verifyApiToken } from "@/lib/auth/apiTokens";
import { apiError } from "./response";

// The single call every protected route handler starts with. Wraps
// verifyApiToken in its own transaction since a successful verification
// also writes lastUsedAt -- consistent with how every other mutation in
// this app goes through db.transaction, even a one-row update. Returns
// the 401 Response directly rather than throwing, so a route handler can
// just do `const auth = await requireApiUser(request); if (auth instanceof
// Response) return auth;` and keep going with a plain { userId } after.
export async function requireApiUser(request: Request): Promise<ApiAuthSession | Response> {
  const session = await db.transaction((tx) => verifyApiToken(tx, request));
  if (!session) return apiError("Invalid or missing API token.", 401);
  return session;
}
