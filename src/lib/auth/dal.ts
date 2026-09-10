import "server-only";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./session";

// The real (non-optimistic) auth check: proxy.ts only reads the cookie and
// redirects as a fast pre-filter, but per Next.js's own auth guidance that
// should not be the only line of defense. Call this from pages and Server
// Actions that need to know who's signed in -- cache() memoizes it per
// request so calling it from several places in one render is free.
//
// Also confirms the user row still exists: the session token is a
// stateless, cryptographically-signed cookie with no server-side record, so
// a token signed before a user was deleted still verifies successfully.
// Without this check, every query downstream that assumes the session's
// userId exists (e.g. the dashboard's user lookup) would crash instead of
// cleanly bouncing back to the login screen.
export const verifySession = cache(async (): Promise<{ userId: string }> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    redirect("/login");
  }

  // Can't clear the cookie here: verifySession() runs during Server
  // Component render as well as inside Server Actions, and cookies() is
  // read-only during render (only Server Actions/Route Handlers can
  // mutate it). The redirect alone is enough -- a stale cookie just keeps
  // failing this same check until overwritten by a fresh login or cleared
  // by an explicit logout.
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, session.userId));
  if (!user) {
    redirect("/login");
  }

  return session;
});
