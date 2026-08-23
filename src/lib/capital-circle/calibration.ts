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
  /**
   * The market price the model was shown for this outcome when it priced it, if
   * recorded. Present so a sample where the model simply handed back the quoted
   * price can be told apart from one where it actually forecast something —
   * those two are identical in every other field and mean opposite things about
   * the model's skill. Null on rows written before the field existed.
   */
  shownPrice?: number | null;
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
  /**
   * Share of scored samples whose stated probability was the market price the
   * model was shown, within tolerance. Null when no sample carries a recorded
   * shown price. A high share means this report is largely measuring the
   * market's forecasts wearing the model's name.
   */
  passthroughShare: number | null;
  /** How many samples were dropped as passthrough before scoring, when that was requested. */
  excludedAsPassthrough: number;
};

export type CalibrationOptions = {
  /**
   * Drop samples where the model returned the price it was shown. They carry no
   * information about the model, and leaving them in flatters every statistic
   * here — a copied price inherits the market's own calibration.
   */
  excludePassthrough?: boolean;
  /** Distance from the shown price within which an estimate counts as copied. */
  passthroughTolerance?: number;
};

const DEFAULT_PASSTHROUGH_TOLERANCE = 0.0005;

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

function isPassthrough(sample: CalibrationSample, tolerance: number): boolean {
  const shown = sample.shownPrice;
  if (shown == null || !Number.isFinite(shown)) return false;
  return Math.abs(sample.probability - shown) <= tolerance;
}

export function computeCalibration(samples: CalibrationSample[], options: CalibrationOptions = {}): CalibrationReport {
  const tolerance = options.passthroughTolerance ?? DEFAULT_PASSTHROUGH_TOLERANCE;
  const wellFormed = samples.filter(
    (sample) => Number.isFinite(sample.probability) && sample.probability >= 0 && sample.probability <= 1 && (sample.outcome === 0 || sample.outcome === 1),
  );

  const withShownPrice = wellFormed.filter((sample) => sample.shownPrice != null && Number.isFinite(sample.shownPrice));
  const passthroughCount = withShownPrice.filter((sample) => isPassthrough(sample, tolerance)).length;
  const passthroughShare = withShownPrice.length > 0 ? round4(passthroughCount / withShownPrice.length) : null;

  const valid = options.excludePassthrough ? wellFormed.filter((sample) => !isPassthrough(sample, tolerance)) : wellFormed;
  const excludedAsPassthrough = wellFormed.length - valid.length;

  if (valid.length === 0) {
    return {
      sampleCount: 0,
      brierScore: null,
      baseRateBrier: null,
      skillScore: null,
      buckets: [],
      meanAbsCalibrationError: null,
      meanBias: null,
      passthroughShare,
      excludedAsPassthrough,
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
    passthroughShare,
    excludedAsPassthrough,
  };
}

// ---------------------------------------------------------------------------
// Assignment inversion — the integrity check that outranks every other number
// in this file
// ---------------------------------------------------------------------------

export type InversionReport = {
  /** Samples in bands far enough from 0.5 for the test to mean anything. */
  sampleCount: number;
  /** Share of those samples whose band is better explained by the flipped assignment, 0-1. */
  invertedShare: number;
  inverted: boolean;
  detail: string | null;
};

/**
 * Bands within this distance of 0.5 are excluded from the test. Inverting a
 * probability near 0.5 barely changes it, so those samples cannot distinguish
 * the two hypotheses and would only dilute the measurement.
 */
const MIN_OFFSET_FROM_EVEN = 0.1;

/** A bucket smaller than this is noise; one bad luck run shouldn't read as inversion. */
const MIN_BUCKET_COUNT = 5;

/** How much better the flipped fit must be before a bucket counts as inverted. */
const INVERSION_MARGIN = 0.06;

/** Below this many off-centre samples the answer isn't worth acting on. */
const MIN_SAMPLES_FOR_INVERSION = 40;

/** Share of off-centre samples that must look flipped before the desk treats it as real. */
const INVERSION_SHARE_THRESHOLD = 0.5;

/**
 * Detects probabilities attached to the wrong outcome.
 *
 * A forecaster that is merely bad produces actual rates that sit between its
 * stated probability and the base rate. A pipeline that has paired
 * probabilities with the wrong side of a market produces actual rates that
 * track 1−p instead — and does so symmetrically, because both sides of every
 * affected market are wrong in opposite directions at once.
 *
 * The distinction matters more than any other number this module computes,
 * because the two call for opposite responses. Bad forecasting is answered by
 * trusting the model less and carrying on. Inverted assignment means the whole
 * measured track record describes something other than what the desk believes
 * it does, and tuning thresholds against it actively selects for the worst
 * cases: a probability compared against the sibling outcome's price shows the
 * largest apparent edge available, so a stricter edge bar concentrates capital
 * into precisely the most badly mis-paired trades.
 *
 * Deliberately conservative. It only looks at bands far enough from 0.5 to
 * discriminate, ignores thin buckets, requires the flipped fit to be clearly
 * better rather than marginally, and needs a real sample before it will say
 * anything at all.
 */
export function detectAssignmentInversion(report: CalibrationReport): InversionReport {
  let consideredCount = 0;
  let invertedCount = 0;
  const invertedBands: string[] = [];

  for (const bucket of report.buckets) {
    if (bucket.count < MIN_BUCKET_COUNT) continue;
    if (Math.abs(bucket.predictedRate - 0.5) < MIN_OFFSET_FROM_EVEN) continue;

    consideredCount += bucket.count;
    const errorIfCorrect = Math.abs(bucket.predictedRate - bucket.actualRate);
    const errorIfFlipped = Math.abs(1 - bucket.predictedRate - bucket.actualRate);
    if (errorIfFlipped + INVERSION_MARGIN < errorIfCorrect) {
      invertedCount += bucket.count;
      invertedBands.push(`${bucket.label} said ~${(bucket.predictedRate * 100).toFixed(0)}% but happened ${(bucket.actualRate * 100).toFixed(0)}%`);
    }
  }

  const invertedShare = consideredCount > 0 ? round4(invertedCount / consideredCount) : 0;
  const inverted = consideredCount >= MIN_SAMPLES_FOR_INVERSION && invertedShare >= INVERSION_SHARE_THRESHOLD;

  return {
    sampleCount: consideredCount,
    invertedShare,
    inverted,
    detail: inverted
      ? `${(invertedShare * 100).toFixed(0)}% of ${consideredCount} off-centre scored predictions match the flipped assignment better than the stated one (${invertedBands.join("; ")}). ` +
        `That is the signature of probabilities recorded against the wrong outcome of a market, not of a poorly calibrated forecaster — and it makes every edge computed from these estimates untrustworthy, because a probability paired with the sibling outcome's price shows the largest apparent edge on the board.`
      : null,
  };
}

export type CategoryPerformance = {
  category: string;
  count: number;
  wins: number;
  winRate: number;
  brierScore: number | null;
};

/**
 * Per-topic breakdown. The model is not equally good at everything — an
 * hourly crypto tick is close to a coin flip whatever it says, while a
 * scheduled event with public information is genuinely researchable. Showing
 * it where it has been losing is more actionable than a single global number.
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
      return {
        category,
        count: rows.length,
        wins,
        winRate: round4(wins / rows.length),
        brierScore: computeCalibration(rows).brierScore,
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
