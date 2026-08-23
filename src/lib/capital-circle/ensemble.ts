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
 * pushes the estimate further from 0.5, d<1 pulls it toward 0.5. Applied per-estimate, independent
 * of estimate-integrity.ts's complement-coherence check — that check quarantines a market whose
 * outcomes don't sum to 1 rather than rescaling it, so there is no Σ=1 constraint here to disturb.
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

function clampProbability(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
