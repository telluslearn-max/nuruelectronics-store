import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, isValidAdminSessionValue } from "@/lib/admin-session-token";

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
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|opengraph-image|robots.txt|sitemap.xml|manifest.webmanifest|icons/).*)",
  ],
};
