import { normalizeWeights, type FitWeights } from "@/lib/intelligence/recommend/fit-score";
import type { ScoredCandidate } from "@/lib/intelligence/recommend/rank";
import type { ScoreComponent } from "@/lib/intelligence/types";

/**
 * The alternatives engine (ranking half).
 *
 * When a shopper's pick is unavailable, the question isn't "what else is
 * good" — it's "what else does most of what this one would have done for
 * *this* shopper". `rankAlternatives` scores each candidate by how much of
 * the target's capability it retains on the components the shopper weighted
 * (falling back to all of the target's scored components when no weights are
 * given), capped so that beating the target on a component counts as "fully
 * meets it", not as extra credit.
 *
 * The availability filter — is it actually in stock — lives in the service
 * layer, not here; this module ranks a pool it's handed.
 */

export const DEFAULT_MATCH_THRESHOLD = 0.9;

export type AlternativeMatch = {
  handle: string;
  /** 0-1: weighted share of the target's capability this candidate retains. */
  matchScore: number;
  /** matchScore >= threshold — "meets at least N% of the requirements". */
  meetsThreshold: boolean;
  /** Weighted components where this candidate falls clearly short of the target (>10 points). */
  shortfalls: ScoreComponent[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Ranks a pool by how much of the target's weighted capability each candidate retains. See module doc. */
export function rankAlternatives(
  target: ScoredCandidate,
  pool: ScoredCandidate[],
  weights: FitWeights,
  threshold: number = DEFAULT_MATCH_THRESHOLD,
): AlternativeMatch[] {
  const normalized = normalizeWeights(weights);
  const weightedComponents = (Object.keys(normalized) as ScoreComponent[]).filter(
    (c) => target.components[c] !== undefined,
  );
  // No usable weights, or none overlap the target's data — compare across
  // everything the target is scored on, equally weighted.
  const components =
    weightedComponents.length > 0
      ? weightedComponents
      : (Object.keys(target.components) as ScoreComponent[]);

  if (components.length === 0) {
    return pool
      .filter((p) => p.handle !== target.handle)
      .map((p) => ({ handle: p.handle, matchScore: 0, meetsThreshold: false, shortfalls: [] }));
  }

  const weightOf = (c: ScoreComponent) => normalized[c] ?? 1 / components.length;
  const totalWeight = components.reduce((sum, c) => sum + weightOf(c), 0);

  return pool
    .filter((p) => p.handle !== target.handle)
    .map((candidate) => {
      let matchSum = 0;
      const shortfalls: ScoreComponent[] = [];
      for (const component of components) {
        const targetScore = target.components[component] ?? 0;
        const altScore = candidate.components[component];
        const ratio =
          altScore === undefined ? 0 : targetScore <= 0 ? 1 : Math.min(1, altScore / targetScore);
        matchSum += (weightOf(component) / totalWeight) * ratio;
        if (altScore !== undefined && targetScore - altScore > 10) shortfalls.push(component);
      }
      const matchScore = round2(matchSum);
      return { handle: candidate.handle, matchScore, meetsThreshold: matchScore >= threshold, shortfalls };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}
