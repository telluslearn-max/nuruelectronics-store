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

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
