import { normalizeWeights, type FitWeights } from "@/lib/intelligence/recommend/fit-score";
import type { RankedCandidate } from "@/lib/intelligence/recommend/rank";
import { SCORE_COMPONENTS, type ScoreComponent } from "@/lib/intelligence/types";

/**
 * The "Why not X?" engine.
 *
 * A shopper challenges a recommendation ("why not the Samsung?"). The honest
 * answer is almost always: the rejected product genuinely wins on some
 * components, but the shopper's own weights put more importance on the ones
 * the winner leads. This computes exactly that split — which components each
 * side wins, and by how much the Fit Score differs — for the concierge to
 * phrase. It never re-runs the recommendation; it explains the one already made.
 */

/** A component-score difference smaller than this (0-100 scale) is called a wash, not a win. */
export const MEANINGFUL_COMPONENT_GAP = 8;

export type WhyNotResult = {
  rejectedHandle: string;
  winnerHandle: string;
  /** Components where the rejected product clearly beats the winner. */
  rejectedWinsOn: ScoreComponent[];
  /** Components where the winner clearly beats the rejected product. */
  winnerWinsOn: ScoreComponent[];
  /** Components the winner leads on that the shopper also weighted — the crux of the answer. */
  winnerWinsOnWeighted: ScoreComponent[];
  /** winner Fit Score − rejected Fit Score, or null if either is unscored. */
  fitScoreGap: number | null;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** The component-by-component split behind "why not X" — which side wins what, and the Fit Score gap. See module doc. */
export function explainWhyNot(
  rejected: RankedCandidate,
  winner: RankedCandidate,
  weights: FitWeights,
): WhyNotResult {
  const weighted = new Set(Object.keys(normalizeWeights(weights)) as ScoreComponent[]);
  const rejectedWinsOn: ScoreComponent[] = [];
  const winnerWinsOn: ScoreComponent[] = [];
  const winnerWinsOnWeighted: ScoreComponent[] = [];

  for (const component of SCORE_COMPONENTS) {
    const r = rejected.components[component];
    const w = winner.components[component];
    if (r === undefined || w === undefined) continue;
    if (r - w >= MEANINGFUL_COMPONENT_GAP) {
      rejectedWinsOn.push(component);
    } else if (w - r >= MEANINGFUL_COMPONENT_GAP) {
      winnerWinsOn.push(component);
      if (weighted.has(component)) winnerWinsOnWeighted.push(component);
    }
  }

  const fitScoreGap =
    rejected.fitScore !== null && winner.fitScore !== null
      ? round2(winner.fitScore - rejected.fitScore)
      : null;

  return {
    rejectedHandle: rejected.handle,
    winnerHandle: winner.handle,
    rejectedWinsOn,
    winnerWinsOn,
    winnerWinsOnWeighted,
    fitScoreGap,
  };
}
