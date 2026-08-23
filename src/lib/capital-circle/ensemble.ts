/**
 * Self-consistency ensembling over the model's probability estimates.
 *
 * A single sampled estimate from a flash model is noisy in a way that costs
 * real money here: one spurious 0.95 on a market trading at 0.55 looks exactly
 * like a large edge, and the old architecture would have traded it. Taking the
 * median of a few independent samples is the cheapest variance reduction
 * available — it costs two extra flash calls per cycle and discards precisely
 * the one-off outliers that the edge gate would otherwise reward.
 *
 * The spread between samples is kept as a signal in its own right: when the
 * model gives 0.4, 0.6 and 0.9 for the same market, the useful conclusion is
 * "it doesn't know", not "0.6". Pure module — see ensemble.test.ts.
 *
 * CAUTION when retuning: `disagreement` is a range (max − min), which is NOT sample-size
 * invariant. The expected range widens as samples are added even when the underlying spread is
 * identical — roughly 1.7σ at three samples against 2.3σ at five. So ENSEMBLE_SAMPLES and
 * ENSEMBLE_MAX_DISAGREEMENT are coupled: raising the sample count alone tightens the effective
 * filter by about a third, and now also shrinks every estimate's λ (see
 * disagreementAdjustedLambda in trade-policy.ts, which reads this number for every candidate
 * rather than only for the ones near the reject threshold). Retune the two together or not at
 * all. Range is kept over a variance-based measure deliberately: at three samples every
 * dispersion statistic is crude, and this one is at least legible in a log line.
 */

export type ProbabilitySample = { marketId: string; tokenId: string; probability: number; rationale?: string };

export type EnsembledEstimate = {
  marketId: string;
  tokenId: string;
  /** Median across samples — robust to a single outlier in a way the mean is not. */
  probability: number;
  /** max − min across samples. High means the model is unstable on this market, not confident. */
  disagreement: number;
  sampleCount: number;
  samples: number[];
  rationale: string | null;
};

/**
 * Collapses N sampled scorings into one estimate per outcome token.
 * Samples with non-finite or out-of-range probabilities are dropped rather
 * than clamped — a malformed value is evidence of a bad parse, not a belief.
 */
export function ensembleProbabilities(samples: ProbabilitySample[][]): EnsembledEstimate[] {
  const byToken = new Map<string, { marketId: string; tokenId: string; values: number[]; rationale: string | null }>();

  for (const sampleSet of samples) {
    for (const sample of sampleSet) {
      if (!sample?.tokenId || !sample?.marketId) continue;
      const value = Number(sample.probability);
      if (!Number.isFinite(value) || value < 0 || value > 1) continue;

      const existing = byToken.get(sample.tokenId);
      if (existing) {
        existing.values.push(value);
        // Keep the first rationale seen: later samples describe the same market, and one
        // stated reason is enough for the audit trail without storing near-duplicates.
        if (!existing.rationale && sample.rationale) existing.rationale = sample.rationale;
      } else {
        byToken.set(sample.tokenId, {
          marketId: sample.marketId,
          tokenId: sample.tokenId,
          values: [value],
          rationale: sample.rationale ?? null,
        });
      }
    }
  }

  const estimates: EnsembledEstimate[] = [];
  for (const entry of byToken.values()) {
    if (entry.values.length === 0) continue;
    estimates.push({
      marketId: entry.marketId,
      tokenId: entry.tokenId,
      probability: median(entry.values),
      disagreement: Math.max(...entry.values) - Math.min(...entry.values),
      sampleCount: entry.values.length,
      samples: [...entry.values],
      rationale: entry.rationale,
    });
  }
  return estimates;
}

/**
 * How much of the slate the model simply handed back.
 *
 * The failure this exists to catch is the one that hid for a whole day of tuning: given each
 * outcome's marketPrice in its input, the scoring model can return that number verbatim. Probed
 * against a live 48-market slate, it did so on 96 of 96 outcomes across three independent samples
 * at temperature 0.7 — not "anchored near the price", byte-identical to it.
 *
 * Nothing downstream can detect that. The estimates parse, the ensemble agrees perfectly (every
 * sample is the same number), calibration and Brier look plausible — but they are scoring the
 * market's forecasts, relabelled as the model's. And edge is λ·(p − price) − cost, so a copied
 * price makes edge exactly −cost on every candidate: the desk prices a hundred outcomes an hour
 * and can never trade, for a reason no log line explains.
 *
 * A high share here is not a bad forecast, it is the absence of one, and the two need telling
 * apart. Compared with a tolerance rather than exact equality so a model that rounds the price
 * it was shown still reads as copying.
 */
export function measureMarketAnchoring(
  estimates: { tokenId: string; probability: number }[],
  marketPriceByToken: Map<string, number>,
  tolerance = 0.0005,
): { compared: number; copied: number; share: number } {
  let compared = 0;
  let copied = 0;
  for (const estimate of estimates) {
    const price = marketPriceByToken.get(estimate.tokenId);
    if (price == null || !Number.isFinite(price)) continue;
    compared++;
    if (Math.abs(estimate.probability - price) <= tolerance) copied++;
  }
  return { compared, copied, share: compared > 0 ? copied / compared : 0 };
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// ---------------------------------------------------------------------------
// Log-odds extremization
// ---------------------------------------------------------------------------

/**
 * Pulls a probability away from 0.5 in log-odds space by factor `d`.
 *
 * Averaging (or taking the median of) several independent forecasts compresses the result toward
 * 0.5 relative to what a single well-informed forecaster would say — a well-documented bias in the
 * forecasting-aggregation literature (Good Judgment Project). d=1 is the identity (no-op); d>1
 * pushes the estimate further from 0.5, d<1 pulls it toward 0.5. Applied per-estimate, before
 * normalizeMarketParity — order matters, since normalizing first and then extremizing each token
 * independently would undo the Σ=1 constraint extremization is meant to compose with, not fight.
 *
 * 0 and 1 are returned unchanged rather than computing an infinite logit: a median of exactly 0 or
 * 1 across independent samples is already the most extreme statement possible, so there is nothing
 * left to extremize.
 */
export function extremizeProbability(probability: number, d: number): number {
  const p = clampProbability(probability);
  if (p <= 0 || p >= 1) return p;
  if (d === 1) return p; // fast path — the common (default, inert) case
  const logit = Math.log(p / (1 - p));
  const extremized = 1 / (1 + Math.exp(-d * logit));
  return clampProbability(extremized);
}

/** Applies extremizeProbability to every estimate's central probability. Samples/disagreement are left untouched — they describe what the model actually said, not the code's post-processing of it. */
export function extremizeEstimates(estimates: EnsembledEstimate[], d: number): EnsembledEstimate[] {
  if (d === 1) return estimates; // no-op — skip the allocation entirely at the default
  return estimates.map((estimate) => ({ ...estimate, probability: extremizeProbability(estimate.probability, d) }));
}

// ---------------------------------------------------------------------------
// Complement / simplex parity normalization
// ---------------------------------------------------------------------------

/**
 * Forces every market's own outcome-token probabilities to sum to exactly 1.
 *
 * A market's outcome tokens (Yes/No for a binary market, or N candidate tokens for a genuinely
 * multi-outcome single market) are by construction mutually exclusive and exhaustive *within that
 * one market* — the model pricing Yes at 0.65 and No at 0.40 independently is simply inconsistent,
 * and rescaling both proportionally (a straight L1 projection onto the simplex) is the correction,
 * not a judgment call. Deliberately proportional rather than softmax-with-temperature: softmax
 * introduces a free parameter (τ) nobody has tuned for this desk, where proportional rescaling has
 * none and preserves the model's own relative weighting between outcomes exactly.
 *
 * Deliberately scoped to one market (grouped by marketId), NOT to every market sharing an eventId.
 * candidate-filter.ts's own eventId comment gives the reason: siblings under one eventId can be
 * different bet *types* on the same real-world event (a match's moneyline, spread, and draw), which
 * have no reason to sum to 1 — only a market's own token set is guaranteed mutually exclusive.
 *
 * A market with only one estimate (the model failed to price its other outcome token) is left
 * alone rather than forced to exactly 1.0 — there's nothing to normalize against, and forcing it
 * would destroy the one real estimate that exists. Same for a near-zero group sum, which would
 * otherwise blow up the division.
 */
export function normalizeMarketParity(estimates: EnsembledEstimate[]): EnsembledEstimate[] {
  const byMarket = new Map<string, EnsembledEstimate[]>();
  for (const estimate of estimates) {
    const list = byMarket.get(estimate.marketId);
    if (list) list.push(estimate);
    else byMarket.set(estimate.marketId, [estimate]);
  }

  return estimates.map((estimate) => {
    const siblings = byMarket.get(estimate.marketId)!;
    if (siblings.length < 2) return estimate;
    const sum = siblings.reduce((total, sibling) => total + sibling.probability, 0);
    if (!Number.isFinite(sum) || sum <= 1e-6) return estimate;
    return { ...estimate, probability: clampProbability(estimate.probability / sum) };
  });
}

function clampProbability(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
