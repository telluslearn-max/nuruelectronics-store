"use server";

import { CONCIERGE_MODEL, getGenAIClient, isConciergeConfigured } from "@/lib/concierge/vertex-client";
import { getCurrentDbCustomerId } from "@/lib/customer";
import { getCustomerRecommendationSignals, getSessionRecommendationHandles } from "@/lib/interactions";
import { getSessionId } from "@/lib/session";
import { getProductByHandle, getProducts } from "@/lib/shopify";
import type { Product } from "@/lib/shopify/types";

const CANDIDATE_POOL_SIZE = 60;
const RECOMMENDATION_COUNT = 8;

async function rankCandidatesWithGemini(signalTitles: string[], candidates: Product[]): Promise<string[]> {
  const ai = getGenAIClient();
  const candidateList = candidates.map((p) => `${p.handle}: ${p.title} (${p.productType})`).join("\n");
  const prompt = `A shopper on our electronics store has shown interest in: ${signalTitles.join(", ")}.\n\nFrom the candidate list below, pick the ${RECOMMENDATION_COUNT} products most likely to interest them next for a homepage "For You" section — prefer complementary or comparable products over near-duplicates of what they already have/viewed. Return ONLY a JSON array of handles, most relevant first — no other text.\n\n${candidateList}`;

  const response = await ai.models.generateContent({
    model: CONCIERGE_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });
  const text = (response.text ?? "").trim();
  const match = text.match(/\[[\s\S]*\]/);
  const parsed: unknown = JSON.parse(match ? match[0] : "[]");
  return Array.isArray(parsed) ? parsed.filter((h): h is string => typeof h === "string") : [];
}

/**
 * Homepage "For You" recommendations, Gemini-ranked against real signal when there's any and
 * Vertex AI is configured, falling back to storewide best sellers otherwise (new visitors, no
 * Vertex, or a failed ranking call) so the section always has real products.
 *
 * The signal itself differs by who's asking — this is the fix for "same question, different
 * customer, different recommendation":
 * - Signed in: real Order history (categories/products actually purchased) plus this customer's
 *   recent Interaction rows (inferred category/intent from browsing and concierge chat) — not just
 *   whatever handles the client happens to pass.
 * - Anonymous: server-side Interaction rows for this browser's session id, merged with the
 *   client-supplied localStorage recently-viewed list (`recentHandles`) rather than replacing it —
 *   the client list can predate this session's Interaction rows.
 */
export async function getPersonalizedHomepageProducts(recentHandles: string[]): Promise<Product[]> {
  try {
    const customerId = await getCurrentDbCustomerId();

    let signalTitles: string[];
    let excludeHandles: string[];

    if (customerId) {
      signalTitles = await getCustomerRecommendationSignals(customerId);
      excludeHandles = recentHandles;
    } else {
      const sessionId = await getSessionId();
      const sessionHandles = sessionId ? await getSessionRecommendationHandles(sessionId) : [];
      const mergedHandles = Array.from(new Set([...recentHandles, ...sessionHandles]));
      excludeHandles = mergedHandles;

      const recentProducts = (await Promise.all(mergedHandles.map((h) => getProductByHandle(h)))).filter(
        (p): p is Product => p !== null,
      );
      signalTitles = recentProducts.map((p) => p.title);
    }

    if (signalTitles.length === 0 || !isConciergeConfigured) {
      const { products } = await getProducts({ sortKey: "BEST_SELLING", first: RECOMMENDATION_COUNT });
      return products;
    }

    const { products: candidatePool } = await getProducts({ first: CANDIDATE_POOL_SIZE });
    const candidates = candidatePool.filter((p) => !excludeHandles.includes(p.handle));
    if (candidates.length === 0) return [];

    let rankedHandles: string[] = [];
    try {
      rankedHandles = await rankCandidatesWithGemini(signalTitles, candidates);
    } catch (error) {
      console.error("Gemini homepage ranking failed:", error);
    }

    const byHandle = new Map(candidates.map((p) => [p.handle, p]));
    const recommended = rankedHandles.map((h) => byHandle.get(h)).filter((p): p is Product => p !== undefined);
    const result = recommended.length > 0 ? recommended : candidates.slice(0, RECOMMENDATION_COUNT);
    return result.slice(0, RECOMMENDATION_COUNT);
  } catch (error) {
    // Catalog fetch failures (Shopify hiccup, etc.) shouldn't surface as a rejected promise —
    // the client has no error UI for this section, just an empty/omitted one.
    console.error("Failed to build homepage recommendations:", error);
    return [];
  }
}
