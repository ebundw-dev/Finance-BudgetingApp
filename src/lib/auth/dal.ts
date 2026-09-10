import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./session";

// The real (non-optimistic) auth check: proxy.ts only reads the cookie and
// redirects as a fast pre-filter, but per Next.js's own auth guidance that
// should not be the only line of defense. Call this from pages and Server
// Actions that need to know who's signed in -- cache() memoizes it per
// request so calling it from several places in one render is free.
export const verifySession = cache(async (): Promise<{ userId: string }> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    redirect("/login");
  }

  return session;
});
