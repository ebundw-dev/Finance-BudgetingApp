import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

// Next.js 16 renamed Middleware to Proxy (same runtime/behavior, new file
// name/export). This is only an optimistic check -- it reads the cookie and
// redirects, but doesn't hit the DB. src/lib/auth/dal.ts's verifySession()
// is the real guard, called from pages/Server Actions themselves.
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // PWA assets (manifest, service worker, its offline fallback page, and
  // icons) must stay reachable without a session -- a browser checking
  // installability or a service worker fetching its own script never
  // sends auth the way a page navigation would, so gating these behind
  // login wouldn't just be redundant, it would silently break "Add to
  // Home Screen" and offline fallback entirely.
  matcher: [
    "/((?!login|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|apple-touch-icon.png|icons/).*)",
  ],
};
