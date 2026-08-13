import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, getSessionSecret, mintSessionCookieValue, readSessionId } from "./session-token";

/** Cart-level attribute key session-tagged carts carry through to the completed Shopify order's
 * customAttributes — see attachSessionAttribute in src/lib/actions.ts and its read-back in
 * importShopifyOrder (src/lib/admin-actions.ts). */
export const SESSION_CART_ATTRIBUTE_KEY = "nuru_session_id";

/** Read-only — safe to call from Server Components during render. proxy.ts mints the cookie for
 * every storefront request before it reaches a page, so this is normally non-null there; returns
 * null only for requests the proxy matcher excludes (e.g. direct /api calls with no prior page load). */
export async function getSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  return readSessionId(cookieStore.get(SESSION_COOKIE)?.value, getSessionSecret());
}

/** Mutates the cookie jar if missing — only call from Server Actions/Route Handlers, never from a
 * Server Component's render path (Next.js forbids cookie writes there). Belt-and-suspenders for
 * paths proxy.ts doesn't cover. */
export async function getOrCreateSessionId(): Promise<string> {
  const cookieStore = await cookies();
  const secret = getSessionSecret();
  const existing = readSessionId(cookieStore.get(SESSION_COOKIE)?.value, secret);
  if (existing) return existing;

  const { id, value } = mintSessionCookieValue(secret);
  cookieStore.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  return id;
}
