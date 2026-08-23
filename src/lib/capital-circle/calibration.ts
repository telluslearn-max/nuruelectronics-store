/**
 * Calibration scoring — does the model's stated probability mean anything?
 *
 * This is the measurement the whole overhaul rests on. A trading agent can be
 * profitable-looking over a small sample by luck, and the old system had no
 * way to tell luck from skill: it recorded a confidence number on every
 * position and then never compared it to a single outcome. Brier score and
 * per-bucket calibration answer the question directly — of the markets the
 * model called 70%, did roughly 70% happen?
 *
 * That answer is not just a report line: computeAdaptiveShrinkage in
 * trade-policy.ts consumes it to decide how much weight the model's estimates
 * get when sizing. Pure module — see calibration.test.ts.
 */

export type CalibrationSample = {
  /** Stated probability for the outcome that was actually bet on / scored, 0-1. */
  probability: number;
  /** 1 if that outcome happened, 0 if it didn't. */
  outcome: 0 | 1;
  category?: string | null;
};

export type CalibrationBucket = {
  label: string;
  lowerBound: number;
  upperBound: number;
  count: number;
  /** Mean stated probability inside the bucket. */
  predictedRate: number;
  /** Share of the bucket that actually happened. */
  actualRate: number;
  /** predicted − actual. Positive means overconfident. */
  gap: number;
};

export type CalibrationReport = {
  sampleCount: number;
  /** Mean squared error of the probability estimates. 0 is perfect; 0.25 is a coin flip; above that is worse than useless. */
  brierScore: number | null;
  /**
   * Brier score a forecaster gets by always predicting the base rate. The
   * absolute Brier number is meaningless without it — 0.20 is excellent on
   * balanced markets and poor on lopsided ones.
   */
  baseRateBrier: number | null;
  /** How much better than the base rate the model is, as a share. Positive means it adds information. */
  skillScore: number | null;
  buckets: CalibrationBucket[];
  /** Mean |predicted − actual| across populated buckets — the input to adaptive shrinkage. */
  meanAbsCalibrationError: number | null;
  /** Positive means systematically overconfident across the board. */
  meanBias: number | null;
};

const BUCKET_EDGES = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0001];

/** E|X| for X ~ N(0, σ) is σ·√(2/π) — the mean absolute deviation of a normal. */
const SQRT_2_OVER_PI = Math.sqrt(2 / Math.PI);

/**
 * How far a bucket's observed rate is expected to land from its predicted rate by luck alone,
 * for a forecaster that is perfectly calibrated.
 *
 * A bucket's actualRate is a binomial proportion over `count` samples, so it has a standard error
 * of √(p(1−p)/n) even when every stated probability is exactly right. |predicted − actual| is
 * therefore a *biased* estimator of calibration error — E|X| exceeds |E X| whenever there is any
 * variance at all, and the gap between them is this quantity.
 *
 * That bias was being read as miscalibration and fed straight into adaptive shrinkage, which is
 * a live production problem rather than a theoretical one. Simulating a perfectly calibrated
 * forecaster through this exact function reports an error of 0.183 at 30 samples, 0.101 at 100,
 * and still 0.023 at 2000 — it never reaches zero. Production was reporting 0.208, which is what
 * a *flawless* forecaster looks like at this sample size. That drove λ to 0.287, which demanded
 * the model disagree with liquid markets by 7.6 points before it could trade at all, so the desk
 * priced 96 outcomes an hour and took nothing.
 *
 * Subtracting the expected noise leaves only the excess — error the sample size cannot explain.
 * The safety property survives: simulated at 300 samples, a perfectly calibrated forecaster
 * scores 0.018, a systematically overconfident one 0.064, and one whose numbers mean nothing
 * 0.168, so a genuinely bad model is still talked down toward following the market.
 */
function expectedGapFromNoise(predictedRate: number, count: number): number {
  if (count <= 0) return 0;
  const variance = Math.max(0, predictedRate * (1 - predictedRate)) / count;
  return Math.sqrt(variance) * SQRT_2_OVER_PI;
}

export function computeCalibration(samples: CalibrationSample[]): CalibrationReport {
  const valid = samples.filter(
    (sample) => Number.isFinite(sample.probability) && sample.probability >= 0 && sample.probability <= 1 && (sample.outcome === 0 || sample.outcome === 1),
  );

  if (valid.length === 0) {
    return {
      sampleCount: 0,
      brierScore: null,
      baseRateBrier: null,
      skillScore: null,
      buckets: [],
      meanAbsCalibrationError: null,
      meanBias: null,
    };
  }

  const brierScore = mean(valid.map((s) => (s.probability - s.outcome) ** 2));
  const baseRate = mean(valid.map((s) => s.outcome));
  const baseRateBrier = mean(valid.map((s) => (baseRate - s.outcome) ** 2));
  // Guard the divide: when every outcome went the same way, the base rate is already
  // perfect and "skill relative to it" isn't a defined quantity.
  const skillScore = baseRateBrier > 0 ? round4(1 - brierScore / baseRateBrier) : null;

  const buckets: CalibrationBucket[] = [];
  for (let i = 0; i < BUCKET_EDGES.length - 1; i++) {
    const lower = BUCKET_EDGES[i];
    const upper = BUCKET_EDGES[i + 1];
    const inBucket = valid.filter((s) => s.probability >= lower && s.probability < upper);
    if (inBucket.length === 0) continue;

    const predictedRate = mean(inBucket.map((s) => s.probability));
    const actualRate = mean(inBucket.map((s) => s.outcome));
    buckets.push({
      label: `${Math.round(lower * 100)}-${Math.round(Math.min(1, upper) * 100)}%`,
      lowerBound: lower,
      upperBound: Math.min(1, upper),
      count: inBucket.length,
      predictedRate: round4(predictedRate),
      actualRate: round4(actualRate),
      gap: round4(predictedRate - actualRate),
    });
  }

  return {
    sampleCount: valid.length,
    brierScore: round4(brierScore),
    baseRateBrier: round4(baseRateBrier),
    skillScore,
    buckets,
    // Weighted by bucket population: a single stray prediction in the 10-20% bucket
    // should not carry the same weight as forty in the 60-70% bucket. Net of the sampling noise
    // a bucket of that size carries anyway (see expectedGapFromNoise) — the raw gap is mostly
    // noise at small counts, and feeding that to adaptive shrinkage stopped the desk trading.
    // Bucket.gap itself stays raw, since the report is showing a human what actually happened.
    meanAbsCalibrationError:
      buckets.length > 0
        ? round4(
            weightedMean(
              buckets.map((b) => ({
                value: Math.max(0, Math.abs(b.gap) - expectedGapFromNoise(b.predictedRate, b.count)),
                weight: b.count,
              })),
            ),
          )
        : null,
    meanBias: round4(mean(valid.map((s) => s.probability - s.outcome))),
  };
}

export type CategoryPerformance = {
  category: string;
  count: number;
  wins: number;
  winRate: number;
  brierScore: number | null;
  /** Same quantity as CalibrationReport.meanAbsCalibrationError, scoped to this category — the input topic-conditioned shrinkage (trade-policy.ts / track-record.ts) needs to compute λ per category instead of one global number. */
  meanAbsCalibrationError: number | null;
};

/**
 * Per-topic breakdown. The model is not equally good at everything — an
 * hourly crypto tick is close to a coin flip whatever it says, while a
 * scheduled event with public information is genuinely researchable. Showing
 * it where it has been losing is more actionable than a single global number,
 * and (via meanAbsCalibrationError) is also what lets λ itself be computed
 * per category rather than blended across domains with very different edge.
 */
export function computeCategoryPerformance(samples: CalibrationSample[]): CategoryPerformance[] {
  const byCategory = new Map<string, CalibrationSample[]>();
  for (const sample of samples) {
    const key = sample.category ?? "uncategorized";
    const list = byCategory.get(key);
    if (list) list.push(sample);
    else byCategory.set(key, [sample]);
  }

  return [...byCategory.entries()]
    .map(([category, rows]) => {
      const wins = rows.filter((r) => r.outcome === 1).length;
      const report = computeCalibration(rows);
      return {
        category,
        count: rows.length,
        wins,
        winRate: round4(wins / rows.length),
        brierScore: report.brierScore,
        meanAbsCalibrationError: report.meanAbsCalibrationError,
      };
    })
    .sort((a, b) => b.count - a.count);
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function weightedMean(entries: { value: number; weight: number }[]): number {
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight === 0) return 0;
  return entries.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / totalWeight;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
