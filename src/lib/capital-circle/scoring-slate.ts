/**
 * Encodes the candidate slate for the model, and decodes its answer back into
 * real market and outcome-token identifiers.
 *
 * This module exists because of a measured production failure, not a
 * hypothetical one. The scoring view used to hand the model a 66-character hex
 * market id and a 77-digit token id per outcome, then require it to echo both
 * back verbatim on every estimate. Long digit strings tokenize badly and carry
 * no meaning, so the only thing tying a probability to the outcome it was
 * formed about was the model's ability to copy an opaque number across a
 * payload holding ninety-six of them. Nothing downstream checked that copy:
 * ensembleProbabilities groups by whatever tokenId comes back, and the
 * selection stage resolves it against the market's own token list, so an
 * estimate that landed on the *sibling* outcome of the right market was
 * indistinguishable from a correct one.
 *
 * The production calibration table is the evidence. Over 499 resolved
 * predictions every confidence band pairs with its mirror — counts within one
 * of each other, actual rates summing to 1.00 — and the mid bands come back
 * cleanly inverted: outcomes called 35% happened 64% of the time, ones called
 * 65% happened 36%, a fit to 1−p within one point. Bands either side of 0.5
 * look fine precisely because inversion is a no-op there. That is the signature
 * of probabilities attached to the wrong side of a two-outcome market, not of a
 * poorly calibrated forecaster.
 *
 * Misassignment is also the most expensive error available to this desk, which
 * is why it gets a module rather than a comment. Edge is measured as the gap
 * between a probability and a price; pairing one outcome's probability with its
 * sibling's price manufactures an enormous apparent gap, and the selection
 * stage is built to hunt for exactly that. A swap does not degrade the desk
 * toward random — it steers capital at the wrong side of the book with
 * conviction, which is worse than random and matches the negative skill score
 * production is reporting.
 *
 * So identity is made structural instead of trusted. Outcomes are addressed by
 * short refs a model can carry reliably, and every estimate must echo the
 * outcome's own name, which code checks against the ref it came with. A name
 * that matches a *different* outcome of the same market is reported as a swap
 * and dropped. Nothing that fails verification reaches the edge gate.
 *
 * Pure module (no server-only, no I/O) — see scoring-slate.test.ts.
 */

import type { ScreenedMarket } from "./candidate-filter";
import type { ProbabilitySample } from "./ensemble";

export type SlateOutcome = {
  /** Short, stable address for this outcome — what the model is asked to echo. */
  ref: string;
  marketRef: string;
  marketId: string;
  tokenId: string;
  outcome: string;
  marketPrice: number;
};

export type ScoringOutcomeView = {
  ref: string;
  outcome: string;
  /** Omitted entirely when the slate is built blind — see buildScoringSlate. */
  marketPrice?: number;
};

export type ScoringMarketView = {
  ref: string;
  /** Short stand-in for eventId: markets sharing one are legs of the same real-world event. */
  eventRef: string | null;
  question: string;
  category: string | null;
  hoursToResolution: number;
  resolutionCriteria: string | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  spread: number | null;
  outcomes: ScoringOutcomeView[];
};

export type ScoringSlate = {
  views: ScoringMarketView[];
  byRef: Map<string, SlateOutcome>;
  /** Every outcome of a market, keyed by market ref — the sibling set a swap is detected against. */
  siblingsByMarketRef: Map<string, SlateOutcome[]>;
  /** How many outcomes the model was asked to price, for coverage reporting. */
  outcomeCount: number;
};

/**
 * Spreadsheet-style column letters (a, b, ... z, aa, ab). Letters rather than
 * digits on purpose: a numeric outcome ref sitting next to a numeric price is
 * exactly the adjacency this module exists to remove.
 */
function outcomeLetter(index: number): string {
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(97 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

export type BuildSlateOptions = {
  /**
   * Whether the model sees each outcome's current market price.
   *
   * Showing it is defensible — the price is a base rate set by people with
   * money at risk. But the code already blends the model's estimate with that
   * same price in shrinkProbability (p' = λ·model + (1−λ)·market), so a model
   * that anchors on the price has it counted twice, and one that simply copies
   * it produces an estimate carrying no information at all. Production has been
   * doing exactly that: the passthrough detector reports the quoted price
   * returned verbatim on 90-96 of 96 outcomes, cycle after cycle, which makes
   * edge equal to −costs by construction.
   *
   * Blinding is therefore available and off by default: it is a behavioural
   * change to what the desk trades, and it should be turned on deliberately and
   * measured on its own, not bundled into a correctness fix.
   */
  showMarketPrice?: boolean;
};

export function buildScoringSlate(markets: ScreenedMarket[], options: BuildSlateOptions = {}): ScoringSlate {
  const showMarketPrice = options.showMarketPrice ?? true;

  const views: ScoringMarketView[] = [];
  const byRef = new Map<string, SlateOutcome>();
  const siblingsByMarketRef = new Map<string, SlateOutcome[]>();
  const eventRefByEventId = new Map<string, string>();
  let outcomeCount = 0;

  markets.forEach((market, marketIndex) => {
    const marketRef = `m${marketIndex + 1}`;

    let eventRef: string | null = null;
    if (market.eventId) {
      const existing = eventRefByEventId.get(market.eventId);
      if (existing) {
        eventRef = existing;
      } else {
        eventRef = `e${eventRefByEventId.size + 1}`;
        eventRefByEventId.set(market.eventId, eventRef);
      }
    }

    const siblings: SlateOutcome[] = [];
    const outcomeViews: ScoringOutcomeView[] = [];

    market.tokens.forEach((token, outcomeIndex) => {
      const ref = `${marketRef}${outcomeLetter(outcomeIndex)}`;
      const slateOutcome: SlateOutcome = {
        ref,
        marketRef,
        marketId: market.conditionId,
        tokenId: token.tokenId,
        outcome: token.outcome,
        marketPrice: token.price,
      };
      siblings.push(slateOutcome);
      byRef.set(ref, slateOutcome);
      outcomeViews.push(
        showMarketPrice ? { ref, outcome: token.outcome, marketPrice: token.price } : { ref, outcome: token.outcome },
      );
      outcomeCount++;
    });

    siblingsByMarketRef.set(marketRef, siblings);
    views.push({
      ref: marketRef,
      eventRef,
      question: market.question,
      category: market.category,
      hoursToResolution: Number(market.hoursToResolution.toFixed(2)),
      resolutionCriteria: market.description,
      liquidityUsd: market.liquidity,
      volume24hUsd: market.volume24hr,
      spread: market.spread,
      outcomes: outcomeViews,
    });
  });

  return { views, byRef, siblingsByMarketRef, outcomeCount };
}

// ---------------------------------------------------------------------------
// Decoding the model's answer
// ---------------------------------------------------------------------------

export type ResolutionIssue =
  | "unknown_ref"
  | "missing_outcome_label"
  | "swapped_outcome"
  | "unrecognized_outcome"
  | "invalid_probability"
  | "duplicate_ref";

export type SwapReport = {
  ref: string;
  /** The outcome name the model returned alongside `ref`. */
  claimed: string;
  /** The outcome that ref actually addresses. */
  expected: string;
  /** The sibling ref whose name the model's label actually matched. */
  matchedRef: string;
};

export type SlateResolution = {
  estimates: ProbabilitySample[];
  issues: Record<ResolutionIssue, number>;
  /** Detail on the dangerous class, capped so a pathological response can't flood a log line. */
  swaps: SwapReport[];
  /** Share of the slate's outcomes that produced a usable estimate, 0-1. */
  coverage: number;
};

const MAX_SWAPS_REPORTED = 12;

/**
 * Case- and punctuation-insensitive, so "T1 " and "t1" match, while leaving
 * genuinely different outcome names ("Arsenal" vs "Chelsea", "Over" vs "Under")
 * as far apart as they are.
 */
export function normalizeOutcomeLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function emptyIssues(): Record<ResolutionIssue, number> {
  return {
    unknown_ref: 0,
    missing_outcome_label: 0,
    swapped_outcome: 0,
    unrecognized_outcome: 0,
    invalid_probability: 0,
    duplicate_ref: 0,
  };
}

/**
 * Turns one scoring sample's raw estimate objects into verified
 * ProbabilitySamples.
 *
 * Every rejection is counted rather than silently dropped. A cycle that loses
 * half its slate to unknown refs and one that loses half to swapped labels look
 * identical from the outside and mean completely different things — the first
 * is a formatting problem, the second means the model's estimates cannot be
 * trusted to describe the outcomes they are attached to.
 */
export function resolveScoringEstimates(entries: unknown[], slate: ScoringSlate): SlateResolution {
  const issues = emptyIssues();
  const swaps: SwapReport[] = [];
  const estimates: ProbabilitySample[] = [];
  const seenRefs = new Set<string>();

  for (const entry of entries) {
    const record = (entry ?? {}) as Record<string, unknown>;
    const ref = typeof record.ref === "string" ? record.ref.trim() : "";
    const slateOutcome = ref ? slate.byRef.get(ref) : undefined;
    if (!slateOutcome) {
      issues.unknown_ref++;
      continue;
    }

    if (seenRefs.has(ref)) {
      issues.duplicate_ref++;
      continue;
    }

    const claimed = typeof record.outcome === "string" ? record.outcome.trim() : "";
    if (!claimed) {
      // Fail closed. An estimate whose outcome label is missing is exactly the
      // unverifiable case this module exists to stop trusting.
      issues.missing_outcome_label++;
      continue;
    }

    const normalizedClaim = normalizeOutcomeLabel(claimed);

    // The referenced outcome's own name is checked first, and a match ends it. Searching the
    // siblings first would misreport a market whose outcomes happen to share a name (two "Yes"
    // legs, say) as a swap, because find() returns the earliest match rather than this one.
    if (normalizeOutcomeLabel(slateOutcome.outcome) !== normalizedClaim) {
      const siblings = slate.siblingsByMarketRef.get(slateOutcome.marketRef) ?? [];
      const matched = siblings.find((sibling) => normalizeOutcomeLabel(sibling.outcome) === normalizedClaim);
      if (!matched) {
        issues.unrecognized_outcome++;
        continue;
      }
      issues.swapped_outcome++;
      if (swaps.length < MAX_SWAPS_REPORTED) {
        swaps.push({ ref, claimed, expected: slateOutcome.outcome, matchedRef: matched.ref });
      }
      continue;
    }

    const probability = Number(record.probability);
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
      issues.invalid_probability++;
      continue;
    }

    seenRefs.add(ref);
    estimates.push({
      marketId: slateOutcome.marketId,
      tokenId: slateOutcome.tokenId,
      probability,
      rationale: typeof record.rationale === "string" ? record.rationale : undefined,
    });
  }

  return {
    estimates,
    issues,
    swaps,
    coverage: slate.outcomeCount > 0 ? estimates.length / slate.outcomeCount : 0,
  };
}

/**
 * Merges the per-sample resolutions of one ensemble run into a single report.
 * The ensemble runs the same slate several times, so an integrity problem shows
 * up once per sample and is only meaningful in aggregate.
 */
export function mergeResolutions(resolutions: SlateResolution[]): Omit<SlateResolution, "estimates"> {
  const issues = emptyIssues();
  const swaps: SwapReport[] = [];
  let coverageSum = 0;

  for (const resolution of resolutions) {
    for (const key of Object.keys(issues) as ResolutionIssue[]) issues[key] += resolution.issues[key];
    for (const swap of resolution.swaps) {
      if (swaps.length < MAX_SWAPS_REPORTED) swaps.push(swap);
    }
    coverageSum += resolution.coverage;
  }

  return {
    issues,
    swaps,
    coverage: resolutions.length > 0 ? coverageSum / resolutions.length : 0,
  };
}

/**
 * One line for the cycle log. Returns null when nothing was rejected, so a
 * clean cycle stays quiet and a dirty one is impossible to miss.
 */
export function describeResolutionIssues(report: Omit<SlateResolution, "estimates">): string | null {
  const total = Object.values(report.issues).reduce((sum, count) => sum + count, 0);
  if (total === 0) return null;

  const parts: string[] = [];
  if (report.issues.swapped_outcome > 0) {
    const example = report.swaps[0];
    parts.push(
      `${report.issues.swapped_outcome} estimate(s) named an outcome that belongs to a DIFFERENT side of the same market` +
        (example ? ` (e.g. ${example.ref} addresses "${example.expected}" but was labelled "${example.claimed}", which is ${example.matchedRef})` : "") +
        ` — these were dropped, not traded, because a probability paired with the sibling's price manufactures a large false edge`,
    );
  }
  if (report.issues.unknown_ref > 0) parts.push(`${report.issues.unknown_ref} referenced an outcome not on the slate`);
  if (report.issues.missing_outcome_label > 0) parts.push(`${report.issues.missing_outcome_label} omitted the outcome label so could not be verified`);
  if (report.issues.unrecognized_outcome > 0) parts.push(`${report.issues.unrecognized_outcome} named an outcome matching no side of their market`);
  if (report.issues.invalid_probability > 0) parts.push(`${report.issues.invalid_probability} carried an out-of-range probability`);
  if (report.issues.duplicate_ref > 0) parts.push(`${report.issues.duplicate_ref} repeated an outcome already priced`);

  return `Estimate integrity: ${parts.join("; ")}.`;
}
