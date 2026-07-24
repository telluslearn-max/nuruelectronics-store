"use server";

import { CONCIERGE_MODEL, getGenAIClient, isConciergeConfigured } from "@/lib/concierge/vertex-client";
import { getProductByHandle, getProducts } from "@/lib/shopify";
import type { Product } from "@/lib/shopify/types";

const CANDIDATE_POOL_SIZE = 60;
const RECOMMENDATION_COUNT = 8;

async function rankCandidatesWithGemini(recentTitles: string[], candidates: Product[]): Promise<string[]> {
  const ai = getGenAIClient();
  const candidateList = candidates.map((p) => `${p.handle}: ${p.title} (${p.productType})`).join("\n");
  const prompt = `A shopper on our electronics store recently viewed: ${recentTitles.join(", ")}.\n\nFrom the candidate list below, pick the ${RECOMMENDATION_COUNT} products most likely to interest them next for a homepage "For You" section — prefer complementary or comparable products over near-duplicates of what they already viewed. Return ONLY a JSON array of handles, most relevant first — no other text.\n\n${candidateList}`;

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
 * Gemini-ranked homepage recommendations from the shopper's own recently-viewed handles (the
 * existing client-side localStorage list — src/components/use-recently-viewed.ts — reused as-is
 * rather than standing up a second, server-side tracking mechanism). Returns [] for new visitors
 * with no history yet, or if Vertex AI isn't configured or the ranking call fails — callers should
 * just omit the section in that case rather than showing an empty state.
 */
export async function getPersonalizedHomepageProducts(recentHandles: string[]): Promise<Product[]> {
  if (recentHandles.length === 0 || !isConciergeConfigured) return [];

  try {
    const recentProducts = (await Promise.all(recentHandles.map((h) => getProductByHandle(h)))).filter(
      (p): p is Product => p !== null,
    );
    if (recentProducts.length === 0) return [];

    const { products: candidatePool } = await getProducts({ first: CANDIDATE_POOL_SIZE });
    const candidates = candidatePool.filter((p) => !recentHandles.includes(p.handle));
    if (candidates.length === 0) return [];

    let rankedHandles: string[] = [];
    try {
      rankedHandles = await rankCandidatesWithGemini(
        recentProducts.map((p) => p.title),
        candidates,
      );
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
