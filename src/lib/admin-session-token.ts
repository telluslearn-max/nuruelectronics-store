import { createHmac, timingSafeEqual } from "node:crypto";

// Pure, cookie-store-free session token signing/verification, deliberately kept
// free of `server-only`/`next/headers` so it can be shared by both
// src/lib/admin-auth.ts (Server Components/Actions) and src/proxy.ts, which
// reads/writes cookies via the NextRequest/NextResponse API instead.

export const ADMIN_SESSION_COOKIE = "admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function buildAdminSessionValue(expiresAt: number, secret: string): string {
  const payload = Buffer.from(JSON.stringify({ exp: expiresAt })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function isValidAdminSessionValue(value: string | undefined, secret: string | undefined): boolean {
  if (!value || !secret) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;
  if (!constantTimeEqual(signature, sign(payload, secret))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp: number };
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}
