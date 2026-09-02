import { computeFitScore, type FitScoreResult, type FitWeights } from "@/lib/intelligence/recommend/fit-score";
import type { ScoreComponent } from "@/lib/intelligence/types";

/**
 * Ranking a set of products for one shopper by Fit Score.
 *
 * The input is deliberately just handle + component scores — this module
 * doesn't know about Prisma, Shopify, or stock. The service layer assembles
 * `ScoredCandidate`s (from NuruScore rows) and decides what pool to rank;
 * this only does the sort.
 */

export type ScoredCandidate = {
  handle: string;
  /** NURU Score components for this product, e.g. { camera: 74, battery: 82 }. */
  components: Partial<Record<ScoreComponent, number>>;
};

export type RankedCandidate = ScoredCandidate & FitScoreResult & { rank: number };

/**
 * Sorts candidates by Fit Score, highest first; products with no evaluable
 * weighted component (fitScore null) sort to the end in their original order.
 * `rank` is 1-based and dense (ties share... no — ties keep input order and
 * still get sequential ranks; this isn't a leaderboard with tie handling).
 */
export function rankByFit(candidates: ScoredCandidate[], weights: FitWeights): RankedCandidate[] {
  return candidates
    .map((candidate) => ({ ...candidate, ...computeFitScore(candidate.components, weights) }))
    .sort((a, b) => {
      if (a.fitScore === null && b.fitScore === null) return 0;
      if (a.fitScore === null) return 1;
      if (b.fitScore === null) return -1;
      return b.fitScore - a.fitScore;
    })
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}
