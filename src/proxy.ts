import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, isValidAdminSessionValue } from "@/lib/admin-session-token";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, getSessionSecret, mintSessionCookieValue, readSessionId } from "@/lib/session-token";

const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === "true";

// Optimistic redirect only — see requireAdminSession() in src/lib/admin-auth.ts,
// which every admin page/Server Action calls independently. Proxy matchers can
// silently miss Server Function calls, so it must never be the sole gate.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    if (pathname.startsWith("/admin/login")) return;
    const sessionValue = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const authed = isValidAdminSessionValue(sessionValue, process.env.ADMIN_SESSION_SECRET);
    if (!authed) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return;
  }

  // Storefront-only gate — /admin stays reachable above so the site can still
  // be managed while MAINTENANCE_MODE is on, and /api is excluded by the
  // matcher below so cron jobs, webhooks, and email-linked customer actions
  // (e.g. estimate responses) keep working.
  if (MAINTENANCE_MODE && pathname !== "/maintenance") {
    return NextResponse.redirect(new URL("/maintenance", request.url));
  }

  // First-party shopper session id (see src/lib/session.ts) — minted here, on
  // first visit, so every downstream Server Component/Action/Route Handler
  // for this request already sees it via next/headers cookies(). Used to
  // attribute anonymous browsing/concierge signals (src/lib/interactions.ts)
  // until the shopper identifies themselves via sign-in or checkout.
  const secret = getSessionSecret();
  if (readSessionId(request.cookies.get(SESSION_COOKIE)?.value, secret)) return;

  const { value } = mintSessionCookieValue(secret);
  request.cookies.set(SESSION_COOKIE, value);
  const response = NextResponse.next({ request });
  response.cookies.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|opengraph-image|robots.txt|sitemap.xml|manifest.webmanifest|icons/).*)",
  ],
};
