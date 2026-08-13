import { createHmac } from "node:crypto";
import { constantTimeEqual } from "./admin-session-token";

// Self-contained signed token for the /feedback/[token] public link — no DB row needed (unlike
// Estimate's accessToken), since everything the page needs (orderId, customerId, expiry) fits in
// the token itself. Reuses ADMIN_SESSION_SECRET as the signing secret (already the app's real,
// required server secret) rather than adding a dedicated env var for this one low-traffic flow.

const FEEDBACK_TOKEN_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // link stays valid for 2 weeks after send

function getSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || process.env.SESSION_SECRET || "nuru-feedback-token-dev-fallback-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function buildFeedbackToken(orderId: string, customerId: string): string {
  const payload = Buffer.from(JSON.stringify({ orderId, customerId, exp: Date.now() + FEEDBACK_TOKEN_MAX_AGE_MS })).toString(
    "base64url",
  );
  return `${payload}.${sign(payload)}`;
}

export type FeedbackTokenPayload = { orderId: string; customerId: string };

export function verifyFeedbackToken(token: string): FeedbackTokenPayload | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !constantTimeEqual(signature, sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      orderId?: unknown;
      customerId?: unknown;
      exp?: unknown;
    };
    if (typeof data.orderId !== "string" || typeof data.customerId !== "string" || typeof data.exp !== "number") {
      return null;
    }
    if (data.exp < Date.now()) return null;
    return { orderId: data.orderId, customerId: data.customerId };
  } catch {
    return null;
  }
}
