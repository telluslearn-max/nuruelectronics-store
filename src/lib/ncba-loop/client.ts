import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// NCBA Loop — NCBA's own developer platform. NURU's M-Pesa Paybill fallback runs through a shared
// account number under NCBA's Paybill (880100), so confirmation comes from NCBA Loop's transaction
// webhooks rather than a Safaricom Daraja C2B registration (not available for a shared/bank-owned
// paybill). Verify the exact signature algorithm and payload field names against NCBA's developer
// docs once API access is granted — this is based on general research (a real, current NCBA product
// with documented real-time transaction webhooks and an X-Loop-Signature header), not a live fetch.

const webhookSecret = process.env.NCBA_LOOP_WEBHOOK_SECRET;

export const isNcbaLoopConfigured = Boolean(webhookSecret);

/** Verifies the inbound webhook's X-Loop-Signature header against the shared secret before trusting the payload. */
export function verifyNcbaLoopSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!webhookSecret || !signatureHeader) return false;

  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(signatureHeader);
  if (expectedBuffer.length !== providedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export type NcbaLoopTransactionEvent = {
  reference: string;
  amount: number;
  transactionId: string;
};

/**
 * Extracts the fields this app cares about from an NCBA Loop transaction webhook payload. Field names
 * are best-effort guesses (checked against a few likely conventions) pending real docs access — flagged
 * clearly so this is easy to correct once the actual payload shape is confirmed.
 */
export function parseNcbaLoopTransactionEvent(payload: unknown): NcbaLoopTransactionEvent | null {
  if (typeof payload !== "object" || payload === null) return null;
  const body = payload as Record<string, unknown>;
  // Some NCBA Loop payloads nest the transaction under a "data" or "transaction" key — check both shapes.
  const data = (body.data ?? body.transaction ?? body) as Record<string, unknown>;

  const reference = data.narration ?? data.reference ?? data.accountReference ?? data.billRefNumber;
  const amount = data.amount ?? data.transactionAmount;
  const transactionId = data.transactionId ?? data.id ?? data.reference;

  if (typeof reference !== "string" || !reference.trim()) return null;
  if (typeof amount !== "number" && typeof amount !== "string") return null;
  if (typeof transactionId !== "string" && typeof transactionId !== "number") return null;

  return {
    reference: reference.trim(),
    amount: Number(amount),
    transactionId: String(transactionId),
  };
}
