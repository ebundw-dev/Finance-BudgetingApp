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
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
