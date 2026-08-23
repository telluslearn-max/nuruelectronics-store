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
  /** When this candidate resolved — the axis an honest train/validate split has to run along. */
  resolvedAt?: Date | null;
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

// ---------------------------------------------------------------------------
// Honest evaluation — the part that stops the sweep table being read as proof
// ---------------------------------------------------------------------------

/**
 * The sweep above is a search, and a search over a fixed dataset finds the
 * dataset's luck as readily as its structure. Twenty parameter combinations
 * replayed over one set of resolved candidates will always produce a best cell,
 * and that cell's return is biased upward by the act of picking it — the more
 * combinations tried, the larger the bias. A live example from this desk: the
 * top cell reported a 1730% return on 11 trades at a 100% win rate, which is
 * indistinguishable from eleven coin flips landing the same way, and reads as
 * overwhelming evidence to anyone glancing at the ranked table.
 *
 * Splitting chronologically fixes the part that matters. Parameters are chosen
 * on the earlier slice and then scored on later markets they had no hand in
 * selecting, which is the only number in this module that estimates what the
 * setting would actually have earned going forward.
 */
export type SplitEvaluation = {
  params: PolicyParams;
  /** Performance on the slice the parameters were chosen from — optimistic by construction. */
  train: PolicyOutcome;
  /** Performance on later data the choice could not see. This is the estimate worth acting on. */
  validate: PolicyOutcome;
};

export type HonestSweepResult = {
  /** Every combination, ranked in-sample. Kept for inspection, not for decisions. */
  inSample: PolicyOutcome[];
  /** The best training cell carried through to unseen data, or null when nothing traded enough to judge. */
  selected: SplitEvaluation | null;
  combinationsTried: number;
  trainCount: number;
  validateCount: number;
  /** Plain-language reading of how much the numbers above can actually support. */
  caveat: string;
};

/** Below this many trades a return figure is a coin-flip streak, not a measurement. */
export const MIN_TRADES_FOR_EVIDENCE = 20;

/**
 * Oldest-first split on resolution time. Candidates without a resolution time
 * keep their given order and sort last — they carry no position on the timeline,
 * and guessing one would quietly leak later markets into the training slice.
 */
export function splitChronologically<T extends { resolvedAt?: Date | null }>(
  candidates: T[],
  trainShare = 0.6,
): { train: T[]; validate: T[] } {
  const share = Math.min(0.95, Math.max(0.05, trainShare));
  const ordered = candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((a, b) => {
      const aTime = a.candidate.resolvedAt?.getTime();
      const bTime = b.candidate.resolvedAt?.getTime();
      if (aTime == null && bTime == null) return a.index - b.index;
      if (aTime == null) return 1;
      if (bTime == null) return -1;
      return aTime - bTime || a.index - b.index;
    })
    .map((entry) => entry.candidate);

  const cut = Math.floor(ordered.length * share);
  return { train: ordered.slice(0, cut), validate: ordered.slice(cut) };
}

export function sweepPoliciesHonestly(
  candidates: LabeledCandidate[],
  options: {
    minEdges?: number[];
    lambdas?: number[];
    capUsd: number;
    bankrollUsd: number;
    kellyFraction?: number;
    trainShare?: number;
    minTradesForEvidence?: number;
  },
): HonestSweepResult {
  const minTrades = options.minTradesForEvidence ?? MIN_TRADES_FOR_EVIDENCE;
  const { train, validate } = splitChronologically(candidates, options.trainShare ?? 0.6);

  const inSample = sweepPolicies(candidates, options);
  const trainResults = sweepPolicies(train, options);

  // Only cells that actually traded enough on the training slice are eligible. A cell
  // that took three trades and won them all is the single most misleading row available.
  const eligible = trainResults.filter((result) => result.tradeCount >= minTrades);
  const best = eligible[0] ?? null;
  const selected: SplitEvaluation | null = best
    ? { params: best.params, train: best, validate: evaluatePolicy(validate, best.params) }
    : null;

  const caveat = buildCaveat({
    combinationsTried: inSample.length,
    selected,
    minTrades,
    trainCount: train.length,
    validateCount: validate.length,
  });

  return {
    inSample,
    selected,
    combinationsTried: inSample.length,
    trainCount: train.length,
    validateCount: validate.length,
    caveat,
  };
}

function buildCaveat(input: {
  combinationsTried: number;
  selected: SplitEvaluation | null;
  minTrades: number;
  trainCount: number;
  validateCount: number;
}): string {
  const base = `${input.combinationsTried} parameter combinations were replayed over the same resolved candidates, so the best in-sample cell is chosen partly for its luck and its return is biased upward.`;

  if (input.selected == null) {
    return `${base} No combination placed at least ${input.minTrades} trades on the ${input.trainCount}-candidate training slice, so nothing here has enough behind it to act on — the table shows what the thresholds do, not what they earn.`;
  }

  const { train, validate } = input.selected;
  if (validate.tradeCount < input.minTrades) {
    return `${base} The best training cell took only ${validate.tradeCount} trade(s) on the ${input.validateCount} held-out candidates, which is too few to confirm it — treat the ${formatReturn(train.returnOnStake)} training return as unverified.`;
  }

  const held = formatReturn(validate.returnOnStake);
  const trained = formatReturn(train.returnOnStake);
  const survived = (validate.returnOnStake ?? 0) > 0;
  return (
    `${base} Chosen on the earlier ${input.trainCount} candidates (${trained} there, ${train.tradeCount} trades) and then scored on ${input.validateCount} later ones it had no part in picking: ${held} over ${validate.tradeCount} trades. ` +
    (survived
      ? `It held up out of sample, which is the only part of this worth acting on.`
      : `It did not hold up out of sample, so the in-sample ranking was fitting noise.`)
  );
}

function formatReturn(value: number | null): string {
  return value == null ? "no return (nothing staked)" : `${(value * 100).toFixed(1)}%`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
