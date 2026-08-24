/**
 * The code-side decision layer — the part of Capital Circle that decides
 * whether a probability estimate is worth money, and how much.
 *
 * Deliberately free of Prisma, network, and LLM calls: every function here is
 * pure, so the arithmetic that the entire PnL series depends on is unit-tested
 * (trade-policy.test.ts) rather than only ever exercised against live markets
 * an hour at a time. This module is also the architectural inversion at the
 * heart of the overhaul — the model estimates probabilities, this code decides
 * what to trade. Previously the model decided both, and nothing checked it.
 *
 * No `server-only` import on purpose: nothing here touches server state, and
 * keeping it importable anywhere is what makes it testable.
 */

import { formatPrice } from "../format"; // pure (no server-only/Prisma) — safe in this module, see the file comment above

import {
  COST_BUFFER,
  DEFAULT_SPREAD_ASSUMPTION,
  FEE_BPS,
  KELLY_FRACTION,
  KELLY_SHRINKAGE,
  MAX_BOOK_DEPTH_SHARE,
  MAX_ENTRY_PRICE,
  MIN_EDGE,
  MIN_ENTRY_PRICE,
  MIN_SAMPLES_FOR_ADAPTIVE_SHRINKAGE,
} from "./config";

// ---------------------------------------------------------------------------
// Effective entry price
// ---------------------------------------------------------------------------

export type PricingInput = {
  /** Top-of-book ask — what a taker actually pays. Preferred over any midpoint. */
  bestAsk?: number | null;
  /** Midpoint or last price, used only when there's no ask. */
  midpoint?: number | null;
  spread?: number | null;
};

/**
 * What buying this outcome really costs, in probability terms.
 *
 * The old code stored Gamma's `outcomePrices` (a mid/last) as entryPrice and
 * settled against it, which quietly overstated every simulated result by half
 * the spread or more — the strategy looked profitable partly because it was
 * never charged for crossing the book. Ask first; mid + half-spread if the
 * book is unavailable; mid + a flat assumption as the last resort.
 */
export function effectiveEntryPrice(input: PricingInput): number | null {
  const ask = toFinite(input.bestAsk);
  if (ask != null && ask > 0) return ask;

  const mid = toFinite(input.midpoint);
  if (mid == null || mid <= 0) return null;

  const spread = toFinite(input.spread);
  if (spread != null && spread > 0) return mid + spread / 2;
  return mid + DEFAULT_SPREAD_ASSUMPTION;
}

// ---------------------------------------------------------------------------
// Probability shrinkage
// ---------------------------------------------------------------------------

/**
 * Pulls the model's probability toward the market price.
 *
 * The market price is a base rate set by people with money at risk; a single
 * language-model estimate is a noisy signal on top of it. Trading the raw
 * estimate treats those as equally informative, which is how an uncalibrated
 * model turns a 0.60 market into a confident 0.95 and loses. λ is how much
 * independent evidence we credit the model with — and once enough predictions
 * have resolved, it stops being a guess (see computeAdaptiveShrinkage).
 */
export function shrinkProbability(modelProbability: number, marketPrice: number, lambda = KELLY_SHRINKAGE): number {
  const p = clamp01(modelProbability);
  const m = clamp01(marketPrice);
  const l = Math.min(1, Math.max(0, lambda));
  return l * p + (1 - l) * m;
}

/**
 * Turns measured calibration into how much the model gets trusted.
 *
 * Under MIN_SAMPLES_FOR_ADAPTIVE_SHRINKAGE resolved predictions there isn't
 * enough signal to beat the prior, so the configured λ stands. Beyond that,
 * mean absolute calibration error (predicted win rate minus actual, averaged
 * over populated confidence buckets) maps to λ: a well-calibrated model earns
 * more weight, a chronically overconfident one gets talked down toward simply
 * following the market. This is the loop that makes the system self-correcting
 * rather than merely instrumented.
 */
// 0 error → 0.60 (trust it); 0.30+ error → 0.15 (barely trust it). Linear between.
const WELL_CALIBRATED_LAMBDA = 0.6;
const BADLY_CALIBRATED_LAMBDA = 0.15;
const WORST_CALIBRATION_ERROR = 0.3;

export function computeAdaptiveShrinkage(input: {
  sampleCount: number;
  meanAbsCalibrationError: number | null;
  /**
   * Set when the track record shows the flipped-assignment signature (see
   * detectAssignmentInversion). This is an integrity failure, not a calibration
   * one, and it has to be handled before the error term is even looked at.
   */
  inverted?: boolean;
  invertedDetail?: string | null;
}): { lambda: number; reason: string; halted: boolean } {
  const { sampleCount, meanAbsCalibrationError } = input;

  // Ordered first on purpose. An inverted track record makes the calibration
  // error term meaningless — it is measuring the distance to the wrong label —
  // so deriving a λ from it produces a confident-looking number built on
  // nothing. Pinned to the floor rather than to the prior because the prior is
  // the *more* trusting value: falling back to it would answer a data-integrity
  // failure by betting more freely on the data that failed.
  if (input.inverted) {
    return {
      lambda: BADLY_CALIBRATED_LAMBDA,
      reason:
        `Assignment inversion detected across ${sampleCount} resolved prediction(s), so measured calibration cannot be used to set trust. ` +
        `λ is pinned to the ${BADLY_CALIBRATED_LAMBDA} floor, which in practice keeps the desk out of the market until the pipeline is fixed and a clean track record rebuilds. ` +
        `${input.invertedDetail ?? ""}`.trim(),
      halted: true,
    };
  }

  if (sampleCount < MIN_SAMPLES_FOR_ADAPTIVE_SHRINKAGE || meanAbsCalibrationError == null) {
    return {
      lambda: KELLY_SHRINKAGE,
      reason: `Only ${sampleCount} resolved prediction(s) — holding the ${KELLY_SHRINKAGE} prior until there are ${MIN_SAMPLES_FOR_ADAPTIVE_SHRINKAGE}.`,
      halted: false,
    };
  }

  const errorShare = Math.min(1, Math.max(0, meanAbsCalibrationError / WORST_CALIBRATION_ERROR));
  const lambda = WELL_CALIBRATED_LAMBDA - errorShare * (WELL_CALIBRATED_LAMBDA - BADLY_CALIBRATED_LAMBDA);
  return {
    lambda: round4(lambda),
    reason: `Calibration error ${meanAbsCalibrationError.toFixed(3)} over ${sampleCount} resolved predictions — trusting the model's estimate at λ=${lambda.toFixed(2)}.`,
    halted: false,
  };
}

/**
 * How much to trust one specific estimate, given how much the ensemble's own samples disagreed
 * about it.
 *
 * λ has always been a single global number: how much independent evidence one flash call is
 * credited with, measured across the whole track record. But stability is also a *per-estimate*
 * property — the same model on the same slate is rock-solid on one market and scattered on the
 * next, and the ensemble already measures exactly that and then threw it away on everything below
 * the reject threshold.
 *
 * Folding it into λ separates the two things the old binary filter conflated: a confident
 * disagreement (tight samples, far from the price) is sized on its merits, while a noisy one (wide
 * samples, same distance from the price) is pulled back toward the market until it no longer
 * clears the bar on its own. That is the distinction that actually predicts whether a deviation is
 * edge or noise, and it is the whole reason ensembling exists.
 *
 * Linear and anchored on the existing ENSEMBLE_MAX_DISAGREEMENT, so it adds no new tunable: trust
 * reaches zero exactly where the hard filter already rejected. The old cliff becomes the limit of
 * the ramp rather than a separate rule — nothing changes at the boundary, and a candidate at 0.24
 * stops being treated identically to one at 0.00 purely for landing on the tolerable side of a
 * threshold.
 */
export function disagreementAdjustedLambda(
  baseLambda: number,
  disagreement: number | null | undefined,
  maxDisagreement: number,
): number {
  const base = Math.min(1, Math.max(0, baseLambda));
  const spread = toFinite(disagreement ?? null);
  if (spread == null || spread <= 0 || maxDisagreement <= 0) return round4(base);
  const trust = Math.min(1, Math.max(0, 1 - spread / maxDisagreement));
  return round4(base * trust);
}

/**
 * How far the model's probability must sit from the market price for a trade to clear the bar.
 *
 * The algebra nobody had written down. Substituting shrinkProbability into the edge definition
 * collapses the whole gate to one term:
 *
 *   edge = λ·p + (1−λ)·a − a − cost  =  λ·(p − a) − cost
 *
 * So the edge gate is not a gate on "edge" as anyone reading MIN_EDGE would picture it — it is a
 * gate on λ × (deviation from price). Inverting it gives what the model actually has to produce:
 *
 *   Δ ≥ (minEdge + cost) / λ
 *
 * This matters because λ moves. At the defaults (λ=0.5, minEdge=0.03, cost=0.01) the model has to
 * disagree with a liquid market by 8 percentage points. When measured calibration pulls λ down to
 * 0.15, the same untouched settings quietly demand 27 points — a deviation no honest forecast of a
 * deep market will ever produce, so the desk stops trading entirely.
 *
 * That behaviour is defensible (a model that cannot forecast should not be betting) and is left
 * exactly as it is. What was not defensible is that it happened invisibly: every cycle reported
 * only "below the 0.03 minimum", which reads as bad luck rather than "calibration has effectively
 * paused this desk". Callers use this to say which of the two is happening.
 *
 * Returns null when λ is 0 — the model is being ignored outright and no deviation can ever clear.
 */
export function requiredDeviation(minEdge: number, lambda: number, costBuffer = COST_BUFFER): number | null {
  const l = Math.min(1, Math.max(0, lambda));
  if (l <= 0) return null;
  return round4((minEdge + costBuffer) / l);
}

// ---------------------------------------------------------------------------
// Trading urgency — the daily-quota mechanism
// ---------------------------------------------------------------------------

export type Urgency = {
  /** The edge threshold this cycle should actually use. */
  minEdge: number;
  /** 0 = fresh off a trade and picky, 1 = fully relaxed and hunting hard. */
  hunger: number;
  hungry: boolean;
  reason: string;
};

/**
 * Slides the edge bar down as a day goes by without a position.
 *
 * The pool exists to be *in* the market. A desk holding out for perfect setups
 * compounds nothing while it waits, and with a strict threshold the agent can
 * trivially go days without trading — which produces no positions, no resolved
 * outcomes, and therefore no calibration data to improve on either. Lowering
 * the bar as the day empties out trades a little edge per position for far more
 * positions, which is the right side of that trade for a pool this size.
 *
 * The ramp is linear between HUNGRY_AFTER_HOURS and STARVING_AFTER_HOURS rather
 * than a switch, so the desk gets steadily less picky instead of holding out all
 * day and then lurching at whatever is in front of it at hour 20.
 *
 * What it never does is go to (or below) zero. A trade with no expected value
 * isn't a position, it's a donation, and manufacturing one to satisfy a quota
 * would be the fastest way to drain the pool. If nothing clears even the
 * relaxed bar, the correct answer is still no trade.
 */
export function computeUrgency(input: {
  hoursSinceLastPosition: number | null;
  positionsToday: number;
  dailyTarget: number;
  baseMinEdge: number;
  hungryMinEdge: number;
  hungryAfterHours: number;
  starvingAfterHours: number;
}): Urgency {
  const { positionsToday, dailyTarget, baseMinEdge, hungryMinEdge, hungryAfterHours, starvingAfterHours } = input;

  if (positionsToday >= dailyTarget) {
    return {
      minEdge: baseMinEdge,
      hunger: 0,
      hungry: false,
      reason: `${positionsToday} position(s) already taken today, meeting the target of ${dailyTarget} — back to the strict ${baseMinEdge} bar, and anything further has to earn it.`,
    };
  }

  // Never traded at all: treat as maximally hungry rather than dividing by nothing.
  const hours = input.hoursSinceLastPosition ?? Number.POSITIVE_INFINITY;

  if (hours <= hungryAfterHours) {
    return {
      minEdge: baseMinEdge,
      hunger: 0,
      hungry: false,
      reason: `Last position was ${Number.isFinite(hours) ? `${hours.toFixed(1)}h` : "never"} ago — still inside the ${hungryAfterHours}h window, holding the strict ${baseMinEdge} bar.`,
    };
  }

  const span = Math.max(1e-9, starvingAfterHours - hungryAfterHours);
  const hunger = Math.min(1, Math.max(0, (hours - hungryAfterHours) / span));
  const minEdge = round4(baseMinEdge - hunger * (baseMinEdge - hungryMinEdge));

  return {
    minEdge,
    hunger: round4(hunger),
    hungry: true,
    reason: `No position for ${Number.isFinite(hours) ? `${hours.toFixed(1)}h` : "the entire history"} and ${positionsToday}/${dailyTarget} taken today — bar relaxed from ${baseMinEdge} to ${minEdge} to get the desk into the market.`,
  };
}

// ---------------------------------------------------------------------------
// Edge gate
// ---------------------------------------------------------------------------

export type EdgeEvaluation = {
  accepted: boolean;
  /** Shrunk probability minus effective entry minus costs. Positive means positive expected value. */
  edge: number;
  effectiveEntry: number | null;
  shrunkProbability: number;
  reason: string;
};

/**
 * The gate that did not exist before: nothing in the old code ever compared
 * the model's stated confidence to the price it was paying, so every thesis
 * the model produced got traded regardless of whether it implied any edge.
 */
export function evaluateEdge(input: {
  modelProbability: number;
  pricing: PricingInput;
  lambda?: number;
  minEdge?: number;
}): EdgeEvaluation {
  const minEdge = input.minEdge ?? MIN_EDGE;
  const lambda = input.lambda ?? KELLY_SHRINKAGE;
  const effectiveEntry = effectiveEntryPrice(input.pricing);

  if (effectiveEntry == null) {
    return {
      accepted: false,
      edge: 0,
      effectiveEntry: null,
      shrunkProbability: clamp01(input.modelProbability),
      reason: "No usable price for this outcome — refusing to trade blind.",
    };
  }

  const shrunk = shrinkProbability(input.modelProbability, effectiveEntry, lambda);
  const feeCost = effectiveEntry * (FEE_BPS / 10_000);
  const edge = round4(shrunk - effectiveEntry - COST_BUFFER - feeCost);

  if (effectiveEntry > MAX_ENTRY_PRICE || effectiveEntry < MIN_ENTRY_PRICE) {
    return {
      accepted: false,
      edge,
      effectiveEntry,
      shrunkProbability: shrunk,
      reason: `Effective entry ${effectiveEntry.toFixed(4)} is outside the tradeable band ${MIN_ENTRY_PRICE}–${MAX_ENTRY_PRICE}.`,
    };
  }

  if (edge < minEdge) {
    // Say what the bar actually demanded, not just that it wasn't met — see requiredDeviation.
    // "below the 0.03 minimum" reads as a near miss; "needed 8.0 points of disagreement and had
    // 1.5" is the number that tells you whether the desk is unlucky or structurally switched off.
    const needed = requiredDeviation(minEdge, lambda);
    const actual = clamp01(input.modelProbability) - effectiveEntry;
    return {
      accepted: false,
      edge,
      effectiveEntry,
      shrunkProbability: shrunk,
      reason:
        `Edge ${edge.toFixed(4)} is below the ${minEdge} minimum. At λ=${lambda} that needs the model ` +
        `${needed == null ? "infinitely far from" : `${(needed * 100).toFixed(1)} points away from`} the ` +
        `${effectiveEntry.toFixed(4)} entry; it was ${(actual * 100).toFixed(1)}.`,
    };
  }

  return {
    accepted: true,
    edge,
    effectiveEntry,
    shrunkProbability: shrunk,
    reason: `Edge ${edge.toFixed(4)}: shrunk probability ${shrunk.toFixed(4)} against an effective entry of ${effectiveEntry.toFixed(4)}.`,
  };
}

// ---------------------------------------------------------------------------
// Sizing
// ---------------------------------------------------------------------------

export type KellyResult = {
  recommendedUsd: number;
  /** The raw Kelly fraction of bankroll before the fractional multiplier and caps. */
  kellyFraction: number;
  reason: string;
};

/**
 * Fractional Kelly for a binary outcome: f* = (p − a) / (1 − a), where `a` is
 * the price paid per share and `p` the (already shrunk) probability.
 *
 * Replaces sizing that was purely "whatever the model asked for, clamped to
 * $25" — meaning conviction and price had no influence on size at all, and a
 * model that always requested the cap always received it. Quarter-Kelly by
 * default, because full Kelly is only optimal when p is known, and here it
 * emphatically is not.
 */
export function kellySize(input: {
  shrunkProbability: number;
  effectiveEntry: number;
  capUsd: number;
  bankrollUsd: number;
  /** Resting USD depth on the ask side, when the book is known. */
  bookDepthUsd?: number | null;
  fraction?: number;
}): KellyResult {
  const p = clamp01(input.shrunkProbability);
  const a = clamp01(input.effectiveEntry);
  const fraction = input.fraction ?? KELLY_FRACTION;

  if (a <= 0 || a >= 1) {
    return { recommendedUsd: 0, kellyFraction: 0, reason: "Entry price outside (0,1) — no Kelly stake is defined." };
  }

  const rawKelly = (p - a) / (1 - a);
  if (rawKelly <= 0) {
    return { recommendedUsd: 0, kellyFraction: 0, reason: "Non-positive Kelly fraction — the trade has no edge to size." };
  }

  let recommended = fraction * rawKelly * input.bankrollUsd;
  const reasons: string[] = [`${fraction}×Kelly on f*=${rawKelly.toFixed(4)} of a ${formatPrice(String(input.bankrollUsd), "USD")} bankroll`];

  if (recommended > input.capUsd) {
    recommended = input.capUsd;
    reasons.push(`clamped to the ${formatPrice(String(input.capUsd), "USD")} per-position cap`);
  }

  const depth = toFinite(input.bookDepthUsd);
  if (depth != null && depth > 0) {
    const depthCap = depth * MAX_BOOK_DEPTH_SHARE;
    if (recommended > depthCap) {
      recommended = depthCap;
      reasons.push(`clamped to ${MAX_BOOK_DEPTH_SHARE * 100}% of ${formatPrice(String(depth), "USD")} resting ask depth`);
    }
  }

  return {
    recommendedUsd: round2(Math.max(0, recommended)),
    kellyFraction: round4(rawKelly),
    reason: reasons.join(", ") + ".",
  };
}

// ---------------------------------------------------------------------------
// Cap application (extracted from sizing-tool so the arithmetic is testable)
// ---------------------------------------------------------------------------

export type CapWindow = { label: string; capUsd: number | null; spentUsd: number };

export function applyCaps(input: {
  requestedUsd: number;
  perTxCapUsd: number;
  windows: CapWindow[];
}): { approvedUsd: number; capUsd: number; capped: boolean; reason: string | null } {
  if (input.requestedUsd <= 0) {
    return { approvedUsd: 0, capUsd: input.perTxCapUsd, capped: false, reason: "Requested size was zero or negative." };
  }

  let approvedUsd = input.requestedUsd;
  let bindingCapUsd = input.perTxCapUsd;
  let reason: string | null = null;

  if (approvedUsd > input.perTxCapUsd) {
    approvedUsd = input.perTxCapUsd;
    reason = `exceeds the per-position cap of ${formatPrice(String(input.perTxCapUsd), "USD")}`;
  }

  for (const window of input.windows) {
    if (window.capUsd == null) continue;
    const headroom = Math.max(0, window.capUsd - window.spentUsd);
    if (approvedUsd > headroom) {
      approvedUsd = headroom;
      bindingCapUsd = window.capUsd;
      reason = `only ${formatPrice(String(headroom), "USD")} of headroom remains under the ${window.label} cap of ${formatPrice(String(window.capUsd), "USD")} (${formatPrice(String(window.spentUsd), "USD")} already committed)`;
    }
  }

  return { approvedUsd: round2(approvedUsd), capUsd: bindingCapUsd, capped: reason != null, reason };
}

// ---------------------------------------------------------------------------
// Selection — which of the priced candidates actually become positions
// ---------------------------------------------------------------------------

export type SelectionCandidate = {
  marketId: string;
  tokenId: string;
  question: string;
  outcome: string;
  eventId?: string | null;
  category?: string | null;
  modelProbability: number;
  disagreement?: number | null;
  pricing: PricingInput;
  bookDepthUsd?: number | null;
  hoursToResolution?: number | null;
};

export type SelectedTrade = SelectionCandidate & {
  edge: number;
  effectiveEntry: number;
  shrunkProbability: number;
  /**
   * The confidence-adjusted λ this trade was actually selected at — carried so the executor's
   * final re-price against the live book uses the same trust level that approved it. Re-gating at
   * the unadjusted global λ would be strictly more generous, which quietly re-opens the door for
   * a scattered estimate whose price has since moved against it.
   */
  lambda: number;
};

export type SelectionResult = {
  selected: SelectedTrade[];
  /** Every candidate that was priced but not selected, with the reason — the audit trail for "why no trade this hour". */
  rejected: { marketId: string; tokenId: string; reason: string; edge: number }[];
};

/**
 * Ranks priced candidates by edge and takes the best few, subject to the
 * constraints that keep a "portfolio" from being one bet wearing three hats:
 * never double up on a market already held, never hold two outcomes from the
 * same event (they are the same wager), and never exceed the per-cycle count.
 */
export function selectTrades(input: {
  candidates: SelectionCandidate[];
  openMarketIds: Set<string>;
  openEventIds: Set<string>;
  maxPositions: number;
  lambda?: number;
  /**
   * Per-category λ (see track-record.ts's categoryShrinkage), keyed by the same category string
   * candidates carry. A candidate whose category has one here uses it instead of `lambda` — the
   * model is not equally trustworthy in every domain (a chronically-overconfident crypto-ticks
   * record shouldn't drag down trust in a well-calibrated politics record, and vice versa).
   * Falls back to `lambda` for an uncategorized candidate or a category with too little history
   * to have its own entry — same MIN_SAMPLES_FOR_ADAPTIVE_SHRINKAGE floor computeAdaptiveShrinkage
   * already applies globally, so an under-sampled category degrades to exactly today's behavior
   * rather than a guess.
   */
  categoryLambdas?: Record<string, number>;
  minEdge?: number;
  maxDisagreement: number;
}): SelectionResult {
  const selected: SelectedTrade[] = [];
  const rejected: SelectionResult["rejected"] = [];
  const takenEventIds = new Set(input.openEventIds);
  const takenMarketIds = new Set(input.openMarketIds);

  const globalLambda = input.lambda ?? KELLY_SHRINKAGE;
  const baseLambdaFor = (candidate: SelectionCandidate): number => {
    const key = candidate.category;
    if (key && input.categoryLambdas?.[key] != null) return input.categoryLambdas[key];
    return globalLambda;
  };

  // λ is adjusted per candidate — first by its category's own track record, then by how much the
  // ensemble disagreed about that specific estimate — so the ranking below is by confidence- and
  // topic-adjusted edge rather than raw edge — a tight estimate 6 points off the price now
  // outranks a scattered one 8 points off, which is the correct ordering and was not the old one.
  const scored = input.candidates
    .map((candidate) => {
      const lambda = disagreementAdjustedLambda(baseLambdaFor(candidate), candidate.disagreement, input.maxDisagreement);
      return {
        candidate,
        lambda,
        evaluation: evaluateEdge({ modelProbability: candidate.modelProbability, pricing: candidate.pricing, lambda, minEdge: input.minEdge }),
      };
    })
    .sort((a, b) => b.evaluation.edge - a.evaluation.edge);

  for (const { candidate, lambda, evaluation } of scored) {
    const reject = (reason: string) => rejected.push({ marketId: candidate.marketId, tokenId: candidate.tokenId, reason, edge: evaluation.edge });

    if (selected.length >= input.maxPositions) {
      reject(`Cycle position limit of ${input.maxPositions} already reached.`);
      continue;
    }
    if (takenMarketIds.has(candidate.marketId)) {
      reject("Already holding a position in this market.");
      continue;
    }
    const eventId = candidate.eventId ?? null;
    if (eventId && takenEventIds.has(eventId)) {
      reject("Already holding a position on this event — the outcomes are correlated, not independent.");
      continue;
    }
    const disagreement = toFinite(candidate.disagreement);
    if (disagreement != null && disagreement > input.maxDisagreement) {
      reject(`Ensemble samples disagreed by ${disagreement.toFixed(3)} (limit ${input.maxDisagreement}) — the estimate isn't stable enough to bet on.`);
      continue;
    }
    if (!evaluation.accepted || evaluation.effectiveEntry == null) {
      reject(evaluation.reason);
      continue;
    }

    selected.push({
      ...candidate,
      edge: evaluation.edge,
      effectiveEntry: evaluation.effectiveEntry,
      shrunkProbability: evaluation.shrunkProbability,
      lambda,
    });
    takenMarketIds.add(candidate.marketId);
    if (eventId) takenEventIds.add(eventId);
  }

  return { selected, rejected };
}

// ---------------------------------------------------------------------------
// Settlement payoff
// ---------------------------------------------------------------------------

export type SettlementComputation = { resultUsd: number; note: string };

/**
 * Payout for a resolved (or exited) position. Shares bought at entryPrice are
 * worth shares × finalPrice, minus what was staked and any modelled costs.
 *
 * The `entryPrice unrecoverable but the position won` branch used to book $0,
 * which reads as "this trade made nothing" in every downstream PnL number —
 * a systematic downward bias on exactly the trades that worked. A win at the
 * most expensive entry we would ever have taken is still conservative, and it
 * is at least the right sign.
 */
export function computeSettlement(input: {
  sizeUsd: number;
  entryPrice: number | null;
  finalPrice: number;
  feesUsd?: number | null;
}): SettlementComputation {
  const fees = toFinite(input.feesUsd) ?? 0;
  const { sizeUsd, entryPrice, finalPrice } = input;

  if (entryPrice != null && entryPrice > 0) {
    const shares = sizeUsd / entryPrice;
    return {
      resultUsd: round2(shares * finalPrice - sizeUsd - fees),
      note: `entry ${entryPrice}, final ${finalPrice}${fees ? `, fees ${formatPrice(String(fees), "USD")}` : ""}`,
    };
  }

  if (finalPrice < 0.5) {
    return {
      resultUsd: round2(-sizeUsd - fees),
      note: `lost — a full loss is exact even without entryPrice, final ${finalPrice}`,
    };
  }

  // Won, entry unknown: price it at the worst entry the policy would ever have allowed.
  const conservativeShares = sizeUsd / MAX_ENTRY_PRICE;
  return {
    resultUsd: round2(conservativeShares * finalPrice - sizeUsd - fees),
    note: `won, but entryPrice unrecoverable — booked at the most expensive allowed entry (${MAX_ENTRY_PRICE}) rather than guessed, final ${finalPrice}`,
  };
}

// ---------------------------------------------------------------------------
// Exits
// ---------------------------------------------------------------------------

export type ExitDecision = { shouldExit: boolean; reason: "take_profit" | "stop" | null; note: string };

/**
 * Whether an open position should be closed early.
 *
 * Every position used to be held to resolution, which meant a token that had
 * already run to 0.97 kept a full-size downside on the table for a payoff of
 * three cents, and a token whose thesis had visibly broken rode to zero.
 */
export function evaluateExit(input: {
  entryPrice: number | null;
  currentPrice: number;
  takeProfitPrice: number;
  stopLossFraction: number;
}): ExitDecision {
  const { currentPrice, takeProfitPrice, stopLossFraction } = input;

  if (currentPrice >= takeProfitPrice) {
    return {
      shouldExit: true,
      reason: "take_profit",
      note: `Price ${currentPrice.toFixed(4)} reached the ${takeProfitPrice} take-profit — banking it rather than carrying resolution risk for the remainder.`,
    };
  }

  const entry = toFinite(input.entryPrice);
  if (entry != null && entry > 0) {
    const stopPrice = entry * (1 - stopLossFraction);
    if (currentPrice <= stopPrice) {
      return {
        shouldExit: true,
        reason: "stop",
        note: `Price ${currentPrice.toFixed(4)} fell to the stop at ${stopPrice.toFixed(4)} (${stopLossFraction * 100}% below the ${entry.toFixed(4)} entry) — the thesis is measurably wrong.`,
      };
    }
  }

  return { shouldExit: false, reason: null, note: "Within the hold band." };
}

// ---------------------------------------------------------------------------

function toFinite(value: number | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
