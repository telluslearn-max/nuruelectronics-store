import "server-only";
import { getScoredCandidateByHandle } from "@/lib/intelligence/recommend/candidates";
import { rankByFit } from "@/lib/intelligence/recommend/rank";
import { explainRecommendation, type Recommendation } from "@/lib/intelligence/recommend/explain";
import type { FitWeights } from "@/lib/intelligence/recommend/fit-score";

/**
 * The structured "why this product fits you" for one product — the reasoning
 * object the concierge and the WebMCP `explain_recommendation` tool both hand
 * to a model to narrate. Null if the product has no computed NURU Score.
 */
export async function explainProductFit(handle: string, weights: FitWeights): Promise<Recommendation | null> {
  const candidate = await getScoredCandidateByHandle(handle);
  if (!candidate) return null;
  const [ranked] = rankByFit([candidate], weights);
  return explainRecommendation(ranked, weights);
}
