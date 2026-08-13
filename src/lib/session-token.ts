import { randomBytes, createHmac } from "node:crypto";
import { constantTimeEqual } from "./admin-session-token";

// Pure, cookie-store-free session id signing/verification — same split as
// admin-session-token.ts, so this can be shared by both src/lib/session.ts
// (Server Components/Actions/Route Handlers, via next/headers) and
// src/proxy.ts, which reads/writes cookies via the NextRequest/NextResponse
// API instead.

export const SESSION_COOKIE = "nuru_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 400; // ~400 days — long-lived, outlives a year of browsing

let fallbackSecret: string | null = null;
let warnedMissingSecret = false;

/** Falls back to a process-local random secret so the cookie still works out of the box (e.g. local
 * dev) — sessions just won't survive a redeploy/restart without SESSION_SECRET set for real. */
export function getSessionSecret(): string {
  const configured = process.env.SESSION_SECRET;
  if (configured) return configured;
  if (!fallbackSecret) fallbackSecret = randomBytes(32).toString("hex");
  if (!warnedMissingSecret) {
    console.warn(
      "SESSION_SECRET is not set — using a process-local fallback. Shopper sessions will reset on every redeploy/restart until SESSION_SECRET is configured.",
    );
    warnedMissingSecret = true;
  }
  return fallbackSecret;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function mintSessionCookieValue(secret: string): { id: string; value: string } {
  const id = randomBytes(16).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ id })).toString("base64url");
  return { id, value: `${payload}.${sign(payload, secret)}` };
}

export function readSessionId(cookieValue: string | undefined, secret: string): string | null {
  if (!cookieValue) return null;
  const [payload, signature] = cookieValue.split(".");
  if (!payload || !signature) return null;
  if (!constantTimeEqual(signature, sign(payload, secret))) return null;
  try {
    const { id } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { id?: unknown };
    return typeof id === "string" && id ? id : null;
  } catch {
    return null;
  }
}
