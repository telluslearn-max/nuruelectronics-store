import "server-only";
import { getCurrentCustomerId } from "@/lib/customer";
import { isCustomerAuthConfigured } from "@/lib/customer-auth";
import { getFirestoreClient, isFirestoreConfigured } from "@/lib/firebase-admin";
import type { ConciergeMessage } from "./types";

const COLLECTION = "conciergeConversations";
const MAX_STORED_MESSAGES = 30;

/** Shopify Customer GIDs (gid://shopify/Customer/123) aren't valid Firestore doc ids ("/" isn't allowed) — use the trailing numeric segment. */
function toDocId(customerId: string): string {
  const segments = customerId.split("/");
  return segments[segments.length - 1] || customerId;
}

export async function getConversationHistory(customerId: string): Promise<ConciergeMessage[]> {
  if (!isFirestoreConfigured) return [];
  try {
    const doc = await getFirestoreClient().collection(COLLECTION).doc(toDocId(customerId)).get();
    const data = doc.data();
    if (!data || !Array.isArray(data.messages)) return [];
    return (data.messages as unknown[]).filter(
      (m): m is ConciergeMessage =>
        typeof m === "object" &&
        m !== null &&
        ((m as { role?: unknown }).role === "user" || (m as { role?: unknown }).role === "model") &&
        typeof (m as { text?: unknown }).text === "string",
    );
  } catch (error) {
    console.error("Failed to load concierge conversation history:", error);
    return [];
  }
}

/** Whole-doc overwrite (not incremental append) — simplest safe option for a doc this small, avoids partial-write ordering issues. */
export async function saveConversationHistory(customerId: string, messages: ConciergeMessage[]): Promise<void> {
  if (!isFirestoreConfigured) return;
  try {
    const trimmed = messages.slice(-MAX_STORED_MESSAGES);
    await getFirestoreClient()
      .collection(COLLECTION)
      .doc(toDocId(customerId))
      .set({ messages: trimmed, updatedAt: new Date() });
  } catch (error) {
    console.error("Failed to save concierge conversation history:", error);
  }
}

/**
 * Saves a turn's final history for whoever is currently signed in, if anyone — a single call
 * site for both the text and voice routes. No-ops for guests or when customer auth/Firestore
 * isn't configured, and swallows its own errors so a persistence hiccup never fails the
 * user-visible turn.
 */
export async function saveHistoryForCurrentCustomer(messages: ConciergeMessage[]): Promise<void> {
  if (!isCustomerAuthConfigured || !isFirestoreConfigured) return;
  try {
    const customerId = await getCurrentCustomerId();
    if (!customerId) return;
    await saveConversationHistory(customerId, messages);
  } catch (error) {
    console.error("Failed to resolve customer for concierge history save:", error);
  }
}
