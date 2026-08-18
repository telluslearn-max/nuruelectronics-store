import "server-only";
import { createPublicKey, createVerify, type KeyObject } from "crypto";

const publicKeyCache = new Map<string, KeyObject>();

/**
 * Per Circle's docs (developers.circle.com/api-reference/verify-webhook-signatures):
 * the public key for a given keyId is static, so it's safe to cache for the
 * life of the process rather than fetching it on every webhook delivery.
 */
async function fetchPublicKey(keyId: string): Promise<KeyObject> {
  const cached = publicKeyCache.get(keyId);
  if (cached) return cached;

  const apiKey = process.env.CIRCLE_API_KEY;
  if (!apiKey) {
    throw new Error("CIRCLE_API_KEY isn't configured — can't fetch the key needed to verify webhook signatures.");
  }

  const response = await fetch(`https://api.circle.com/v2/notifications/publicKey/${keyId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch Circle's notification public key (HTTP ${response.status}).`);
  }
  const { data } = await response.json();
  const publicKey = createPublicKey({ key: Buffer.from(data.publicKey, "base64"), format: "der", type: "spki" });
  publicKeyCache.set(keyId, publicKey);
  return publicKey;
}

/**
 * Verifies a Circle v2 webhook notification (ECDSA_SHA_256 over the *raw*
 * request body — parsing the JSON and re-serializing it changes byte order
 * and breaks verification, so `rawBody` must be the untouched request body
 * text, read before any JSON.parse). Never throws — any failure (missing
 * config, network error, bad signature) returns false so the caller always
 * gets a clean reject rather than an unhandled exception on a webhook route.
 */
export async function verifyCircleWebhookSignature(
  rawBody: string,
  signatureBase64: string,
  keyId: string,
): Promise<boolean> {
  try {
    const publicKey = await fetchPublicKey(keyId);
    const verifier = createVerify("SHA256");
    verifier.update(rawBody);
    return verifier.verify(publicKey, signatureBase64, "base64");
  } catch (error) {
    console.error("[circle-webhook] signature verification failed:", error);
    return false;
  }
}
