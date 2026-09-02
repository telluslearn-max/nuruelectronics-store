import { SCORE_COMPONENTS, type ScoreComponent } from "@/lib/intelligence/types";

/**
 * The Fit Score engine.
 *
 * NURU Score (scoring/nuru-score.ts) is one number per product. Fit Score is
 * personalized: the same product scores differently for a camera-first buyer
 * than for a gaming-first one. Per the build brief, there is deliberately no
 * fixed menu of weighting presets — the concierge turns a shopper's own words
 * ("camera and battery matter most") into a weight vector, and this module
 * does the arithmetic on it. The model proposes the weights; it never touches
 * the scoring math.
 *
 * A component the shopper didn't mention gets no weight at all — silently
 * splitting the remainder evenly across unmentioned components would invent
 * a preference nobody stated. It's the concierge's job to translate intent
 * into a complete-enough vector; this module only normalizes and applies
 * whatever it's given.
 */

/** A shopper's priorities: component -> relative importance. Any positive scale — only relative weight matters. Omitted components carry no weight. */
export type FitWeights = Partial<Record<ScoreComponent, number>>;

export type FitScoreResult = {
  /** Null when none of the weighted components have a score for this product. */
  fitScore: number | null;
  /** Which of the weighted components this product actually had data for. */
  weightedComponents: ScoreComponent[];
  /** Share (0-1) of the shopper's total weight that could actually be evaluated on this product. */
  coverage: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Drops non-positive weights and rescales the rest to sum to 1. Empty/all-non-positive input yields `{}`. */
export function normalizeWeights(weights: FitWeights): Partial<Record<ScoreComponent, number>> {
  const positive: Partial<Record<ScoreComponent, number>> = {};
  let total = 0;
  for (const component of SCORE_COMPONENTS) {
    const weight = weights[component];
    if (typeof weight === "number" && weight > 0) {
      positive[component] = weight;
      total += weight;
    }
  }
  if (total === 0) return {};
  const normalized: Partial<Record<ScoreComponent, number>> = {};
  for (const component of Object.keys(positive) as ScoreComponent[]) {
    normalized[component] = positive[component]! / total;
  }
  return normalized;
}

/**
 * A product's personalized Fit Score: the shopper's weights applied to this
 * product's NURU Score components, renormalized over only the components both
 * the shopper cares about and the product has data for — same "missing data
 * lowers coverage, never the score" rule as the composite NURU Score.
 */
export function computeFitScore(
  components: Partial<Record<ScoreComponent, number>>,
  weights: FitWeights,
): FitScoreResult {
  const normalized = normalizeWeights(weights);
  const weightedComponents: ScoreComponent[] = [];
  let scoredWeight = 0;
  let weightedSum = 0;

  for (const component of Object.keys(normalized) as ScoreComponent[]) {
    const score = components[component];
    if (score === undefined) continue;
    const weight = normalized[component]!;
    weightedComponents.push(component);
    scoredWeight += weight;
    weightedSum += weight * score;
  }

  if (scoredWeight === 0) return { fitScore: null, weightedComponents: [], coverage: 0 };
  return {
    fitScore: round2(weightedSum / scoredWeight),
    weightedComponents,
    coverage: round2(scoredWeight),
  };
}
