import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, isValidAdminSessionValue } from "@/lib/admin-session-token";

// Optimistic redirect only — see requireAdminSession() in src/lib/admin-auth.ts,
// which every admin page/Server Action calls independently. Proxy matchers can
// silently miss Server Function calls, so it must never be the sole gate.
export function proxy(request: NextRequest) {
  const sessionValue = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const authed = isValidAdminSessionValue(sessionValue, process.env.ADMIN_SESSION_SECRET);
  if (!authed) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
}

export const config = {
  matcher: ["/admin/((?!login).*)"],
};
