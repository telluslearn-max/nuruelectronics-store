import { normalizeWeights, type FitWeights } from "@/lib/intelligence/recommend/fit-score";
import type { RankedCandidate } from "@/lib/intelligence/recommend/rank";
import type { ScoreComponent } from "@/lib/intelligence/types";

/**
 * Structured reasoning for a recommendation.
 *
 * This is the "the AI narrates, it doesn't decide" boundary from the build
 * brief. `explainRecommendation` produces a fixed-shape object — which
 * components are strengths, which are weaknesses, which drove the pick — and
 * the concierge turns that into a sentence. The model is never asked *why* a
 * product won; it's handed the answer and asked to phrase it.
 */

/** A component scoring at or above this (0-100) is called a strength. */
export const STRENGTH_THRESHOLD = 70;
/** At or below this, a weakness. */
export const WEAKNESS_THRESHOLD = 45;

export type Recommendation = {
  handle: string;
  fitScore: number | null;
  /** Share (0-1) of the shopper's stated priorities that could be evaluated on this product. */
  coverage: number;
  /** Weighted components this product scores well on — the reasons to buy it. */
  strengths: ScoreComponent[];
  /** Weighted components this product scores poorly on — the caveats. */
  weaknesses: ScoreComponent[];
  /** The 1-2 highest-weight components that most explain the Fit Score — the "primary reason". */
  primaryDrivers: ScoreComponent[];
};

/** The structured "why this product" for a ranked candidate — strengths, weaknesses, primary drivers. See module doc. */
export function explainRecommendation(candidate: RankedCandidate, weights: FitWeights): Recommendation {
  const normalized = normalizeWeights(weights);

  const strengths = candidate.weightedComponents.filter(
    (c) => (candidate.components[c] ?? 0) >= STRENGTH_THRESHOLD,
  );
  const weaknesses = candidate.weightedComponents.filter(
    (c) => (candidate.components[c] ?? 0) <= WEAKNESS_THRESHOLD,
  );

  // Primary drivers: the heaviest-weighted evaluated components, taken in order
  // until they account for at least half of the covered weight (always ≥1).
  const byWeight = [...candidate.weightedComponents].sort(
    (a, b) => (normalized[b] ?? 0) - (normalized[a] ?? 0),
  );
  const coveredWeight = candidate.weightedComponents.reduce((sum, c) => sum + (normalized[c] ?? 0), 0);
  const primaryDrivers: ScoreComponent[] = [];
  let accumulated = 0;
  for (const component of byWeight) {
    primaryDrivers.push(component);
    accumulated += normalized[component] ?? 0;
    if (accumulated >= coveredWeight * 0.5) break;
  }

  return {
    handle: candidate.handle,
    fitScore: candidate.fitScore,
    coverage: candidate.coverage,
    strengths,
    weaknesses,
    primaryDrivers,
  };
}
