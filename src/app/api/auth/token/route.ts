import { db } from "@/db";
import { verifyCredentials } from "@/lib/auth/credentials";
import { issueApiToken } from "@/lib/auth/apiTokens";
import { apiError, apiSuccess } from "@/lib/api/response";

// Issues a new API token given valid login credentials -- the mobile
// app's equivalent of the web login form. Reuses verifyCredentials, the
// exact same email/password check the web login Server Action uses (see
// src/lib/auth/credentials.ts), rather than duplicating it. Not
// Bearer-authed itself, obviously: this is how a client gets its first
// token.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body.", 400);
  }

  const { email, password, name } = (body ?? {}) as {
    email?: unknown;
    password?: unknown;
    name?: unknown;
  };

  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
    return apiError("email and password are required.", 400);
  }
  const tokenName = typeof name === "string" && name.trim() ? name.trim() : "API token";

  const user = await verifyCredentials(email, password);
  if (!user) {
    return apiError("Invalid email or password.", 401);
  }

  const issued = await db.transaction((tx) => issueApiToken(tx, user.id, tokenName));

  return apiSuccess(
    { id: issued.id, token: issued.token, name: issued.name, createdAt: issued.createdAt },
    201
  );
}
