/**
 * Checks that a cycle's estimates are internally consistent before any of them
 * are allowed to become money.
 *
 * scoring-slate.ts verifies that each estimate is attached to the outcome it
 * claims to describe. This module checks the complementary property: that the
 * estimates for one market describe a coherent set of beliefs about it. The two
 * catch different failures — a model can label every outcome correctly and
 * still return 0.8 for both sides of a two-way market, which is not a forecast
 * of anything, and would hand the edge gate a large fabricated deviation on
 * whichever side happened to be cheaper.
 *
 * Polymarket markets are mutually exclusive and exhaustive within themselves: a
 * binary market's two outcome tokens both settle, one at 1 and one at 0, so
 * honest probabilities across a market's outcomes sum to 1. That makes the sum
 * a free, assumption-light integrity test on every cycle, and one the desk was
 * previously not performing at all.
 *
 * Quarantine rather than repair is deliberate. Normalizing an incoherent pair
 * back to sum 1 would invent a belief the model never stated and hide the fault
 * that produced it; the point here is that a market the model was confused
 * about is a market the desk should not be trading this hour.
 *
 * Pure module (no server-only, no I/O) — see estimate-integrity.test.ts.
 */

import type { ScoringSlate } from "./scoring-slate";

export type CoherenceInput = {
  tokenId: string;
  probability: number;
};

export type IncoherentMarket = {
  marketRef: string;
  marketId: string;
  question: string;
  /** What the model's probabilities for this market's outcomes actually summed to. */
  sum: number;
  outcomes: { outcome: string; probability: number }[];
};

export type CoherenceReport = {
  /** Markets where every outcome got an estimate, so the sum is meaningful. */
  checked: number;
  /** Markets skipped because the model didn't price every side of them. */
  incomplete: number;
  incoherent: IncoherentMarket[];
  /** Token ids that must not be traded this cycle. */
  quarantinedTokenIds: Set<string>;
};

/**
 * How far a market's probabilities may sum from 1 before the set is treated as
 * incoherent.
 *
 * Not zero: the ensemble takes a per-outcome median across independent samples,
 * and the median of a set of coherent pairs is not itself guaranteed to sum to
 * exactly 1. A few points of slack absorbs that without absorbing a real
 * contradiction — 0.8/0.8 or 0.2/0.2 clears this by a mile.
 */
export const DEFAULT_COMPLEMENT_TOLERANCE = 0.1;

export function checkComplementCoherence(
  estimates: CoherenceInput[],
  slate: ScoringSlate,
  questionByMarketId: Map<string, string> = new Map(),
  tolerance: number = DEFAULT_COMPLEMENT_TOLERANCE,
): CoherenceReport {
  const probabilityByToken = new Map<string, number>();
  for (const estimate of estimates) {
    if (Number.isFinite(estimate.probability)) probabilityByToken.set(estimate.tokenId, estimate.probability);
  }

  const incoherent: IncoherentMarket[] = [];
  const quarantinedTokenIds = new Set<string>();
  let checked = 0;
  let incomplete = 0;

  for (const [marketRef, siblings] of slate.siblingsByMarketRef) {
    if (siblings.length < 2) continue;

    const priced = siblings.map((sibling) => ({ sibling, probability: probabilityByToken.get(sibling.tokenId) }));
    if (priced.some((entry) => entry.probability == null)) {
      // A partially priced market says nothing about coherence — the missing side
      // could have carried any value. Counted so a slate that is quietly losing
      // half its estimates to truncation is still visible.
      incomplete++;
      continue;
    }

    checked++;
    const sum = priced.reduce((total, entry) => total + (entry.probability ?? 0), 0);
    if (Math.abs(sum - 1) <= tolerance) continue;

    const marketId = siblings[0].marketId;
    incoherent.push({
      marketRef,
      marketId,
      question: questionByMarketId.get(marketId) ?? marketId,
      sum: round4(sum),
      outcomes: priced.map((entry) => ({ outcome: entry.sibling.outcome, probability: entry.probability ?? 0 })),
    });
    for (const sibling of siblings) quarantinedTokenIds.add(sibling.tokenId);
  }

  return { checked, incomplete, incoherent, quarantinedTokenIds };
}

/** One line for the cycle log, or null when every priced market was coherent. */
export function describeCoherence(report: CoherenceReport): string | null {
  if (report.incoherent.length === 0) return null;
  const example = report.incoherent[0];
  return (
    `Coherence: ${report.incoherent.length} of ${report.checked} fully priced market(s) had outcome probabilities that don't sum to 1 ` +
    `(e.g. "${example.question}" summed to ${example.sum} across ${example.outcomes.map((o) => `${o.outcome} ${o.probability}`).join(" / ")}). ` +
    `Those markets were quarantined for this cycle — a market the model contradicts itself about is not one to size a position on.`
  );
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
