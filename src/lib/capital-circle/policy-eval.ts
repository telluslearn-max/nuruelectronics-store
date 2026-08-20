/**
 * Counterfactual policy evaluation.
 *
 * Every cycle prices the whole candidate slate and settlement backfills each
 * candidate's real outcome, so the snapshot table accumulates labeled examples
 * for markets that were *passed on* as well as traded. That makes it possible
 * to ask what a different policy would have earned — a tighter edge threshold,
 * a different shrinkage, a larger Kelly fraction — over markets that have
 * already resolved, instead of waiting weeks to find out live.
 *
 * The selection-bias point is the whole reason this exists: measuring only
 * taken trades measures a sample chosen by the very judgement under test. This
 * evaluates the policy over everything it saw.
 *
 * Pure module — see policy-eval.test.ts.
 */

import { effectiveEntryPrice, kellySize, shrinkProbability } from "./trade-policy";
import { COST_BUFFER, KELLY_FRACTION, MAX_ENTRY_PRICE, MIN_ENTRY_PRICE } from "./config";

export type LabeledCandidate = {
  marketId: string;
  tokenId: string;
  category?: string | null;
  modelProbability: number;
  bestAsk?: number | null;
  midpoint?: number | null;
  spread?: number | null;
  /** 1 if this outcome won, 0 if it lost. */
  outcome: 0 | 1;
};

export type PolicyParams = {
  minEdge: number;
  lambda: number;
  kellyFraction?: number;
  capUsd: number;
  bankrollUsd: number;
};

export type PolicyOutcome = {
  params: PolicyParams;
  /** How many of the labeled candidates this policy would have traded. */
  tradeCount: number;
  wins: number;
  winRate: number;
  stakedUsd: number;
  pnlUsd: number;
  /** PnL per dollar staked — comparable across policies that trade very different volumes. */
  returnOnStake: number | null;
  /** Mean edge the policy believed it was getting, vs what it actually realized. */
  meanExpectedEdge: number;
  realizedEdge: number | null;
};

/**
 * Replays one policy over labeled candidates. Fills are priced at the
 * effective (ask-side) entry, and a losing outcome loses the whole stake —
 * the same arithmetic settlement uses, so the numbers are comparable to the
 * real PnL series rather than a rosier parallel one.
 */
export function evaluatePolicy(candidates: LabeledCandidate[], params: PolicyParams): PolicyOutcome {
  let tradeCount = 0;
  let wins = 0;
  let stakedUsd = 0;
  let pnlUsd = 0;
  let expectedEdgeSum = 0;

  for (const candidate of candidates) {
    const entry = effectiveEntryPrice({ bestAsk: candidate.bestAsk, midpoint: candidate.midpoint, spread: candidate.spread });
    if (entry == null || entry < MIN_ENTRY_PRICE || entry > MAX_ENTRY_PRICE) continue;

    const shrunk = shrinkProbability(candidate.modelProbability, entry, params.lambda);
    const edge = shrunk - entry - COST_BUFFER;
    if (edge < params.minEdge) continue;

    const { recommendedUsd } = kellySize({
      shrunkProbability: shrunk,
      effectiveEntry: entry,
      capUsd: params.capUsd,
      bankrollUsd: params.bankrollUsd,
      fraction: params.kellyFraction ?? KELLY_FRACTION,
    });
    if (recommendedUsd <= 0) continue;

    tradeCount++;
    stakedUsd += recommendedUsd;
    expectedEdgeSum += edge;

    if (candidate.outcome === 1) {
      wins++;
      // Shares bought at `entry` each pay out 1 at resolution.
      pnlUsd += recommendedUsd / entry - recommendedUsd;
    } else {
      pnlUsd -= recommendedUsd;
    }
  }

  return {
    params,
    tradeCount,
    wins,
    winRate: tradeCount > 0 ? round4(wins / tradeCount) : 0,
    stakedUsd: round2(stakedUsd),
    pnlUsd: round2(pnlUsd),
    returnOnStake: stakedUsd > 0 ? round4(pnlUsd / stakedUsd) : null,
    meanExpectedEdge: tradeCount > 0 ? round4(expectedEdgeSum / tradeCount) : 0,
    realizedEdge: stakedUsd > 0 ? round4(pnlUsd / stakedUsd) : null,
  };
}

/**
 * Grid search over the two parameters that actually decide behaviour: how
 * much edge is required, and how much the model's estimate is trusted. Turns
 * threshold tuning from taste into a table — and, importantly, shows whether
 * the configured setting sits on a plateau or a knife edge. A policy that only
 * works at exactly one threshold is fitted to noise.
 */
export function sweepPolicies(
  candidates: LabeledCandidate[],
  options: {
    minEdges?: number[];
    lambdas?: number[];
    capUsd: number;
    bankrollUsd: number;
    kellyFraction?: number;
  },
): PolicyOutcome[] {
  const minEdges = options.minEdges ?? [0.02, 0.05, 0.08, 0.12, 0.2];
  const lambdas = options.lambdas ?? [0.15, 0.35, 0.6, 1];

  const results: PolicyOutcome[] = [];
  for (const lambda of lambdas) {
    for (const minEdge of minEdges) {
      results.push(
        evaluatePolicy(candidates, {
          minEdge,
          lambda,
          capUsd: options.capUsd,
          bankrollUsd: options.bankrollUsd,
          kellyFraction: options.kellyFraction,
        }),
      );
    }
  }
  // Best return on stake first, but a policy that traded almost nothing isn't evidence
  // of anything — callers should read tradeCount alongside the ranking.
  return results.sort((a, b) => (b.returnOnStake ?? -Infinity) - (a.returnOnStake ?? -Infinity));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
