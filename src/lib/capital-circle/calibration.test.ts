import { describe, expect, it } from "vitest";
import { computeCalibration, computeCategoryPerformance, detectAssignmentInversion, type CalibrationSample } from "./calibration";

/** n samples at probability p, of which `winRate` share actually happened. */
function samples(p: number, n: number, winRate: number, category?: string): CalibrationSample[] {
  const winCount = Math.round(n * winRate);
  return Array.from({ length: n }, (_, i) => ({ probability: p, outcome: (i < winCount ? 1 : 0) as 0 | 1, category }));
}

describe("computeCalibration", () => {
  it("scores a perfectly calibrated forecaster as unbiased", () => {
    const report = computeCalibration([...samples(0.7, 100, 0.7), ...samples(0.3, 100, 0.3)]);
    expect(report.meanBias).toBeCloseTo(0, 2);
    expect(report.meanAbsCalibrationError).toBeCloseTo(0, 2);
  });

  it("detects systematic overconfidence — the failure mode the loop exists to correct", () => {
    // Says 90%, happens 50% of the time.
    const report = computeCalibration(samples(0.9, 100, 0.5));
    expect(report.meanBias).toBeCloseTo(0.4, 2);
    // The bucket's own gap stays raw — the report is showing a human what actually happened.
    expect(report.buckets[0].gap).toBeCloseTo(0.4, 2);
    // meanAbsCalibrationError is net of the sampling noise a bucket this size carries anyway:
    // √(0.9·0.1/100)·√(2/π) ≈ 0.024. Still an enormous error, which is the point — de-noising
    // removes the floor, not the signal.
    expect(report.meanAbsCalibrationError).toBeCloseTo(0.4 - 0.0239, 3);
    expect(report.meanAbsCalibrationError).toBeGreaterThan(0.3);
  });

  it("does not read small-sample noise as miscalibration", () => {
    // The live failure this guards against. A forecaster saying 50% on a bucket of 4, of which 3
    // happened, looks 25 points off — but a coin is off by that much constantly at n=4. Reported
    // as-is it drove λ down to 0.287 in production, which demanded a 7.6-point disagreement with
    // liquid markets before the desk could trade, so it priced 96 outcomes an hour and took none.
    const noisy = computeCalibration(samples(0.5, 4, 0.75));
    expect(noisy.buckets[0].gap).toBeCloseTo(-0.25, 2);
    // √(0.25/4)·√(2/π) ≈ 0.1995 of that 0.25 is explainable by luck, leaving ≈0.05. Not zero —
    // de-noising discounts small samples rather than ignoring them — but an 80% reduction, and
    // the difference between λ≈0.52 (keeps trading) and λ≈0.23 (effectively switched off).
    expect(noisy.meanAbsCalibrationError).toBeCloseTo(0.0505, 3);

    // The same 25-point gap over enough samples that luck cannot explain it survives almost
    // intact — the correction scales with 1/√n, so it vanishes exactly where evidence accrues.
    const real = computeCalibration(samples(0.5, 400, 0.75));
    expect(real.meanAbsCalibrationError).toBeGreaterThan(0.23);
  });

  it("detects underconfidence with the opposite sign", () => {
    const report = computeCalibration(samples(0.3, 100, 0.7));
    expect(report.meanBias).toBeCloseTo(-0.4, 2);
  });

  it("computes Brier score against the base rate, not in a vacuum", () => {
    // A forecaster who always says 0.5 on a 50/50 world scores 0.25 — the same as the base rate,
    // so zero skill despite a number that sounds respectable in isolation.
    const report = computeCalibration(samples(0.5, 100, 0.5));
    expect(report.brierScore).toBeCloseTo(0.25, 3);
    expect(report.baseRateBrier).toBeCloseTo(0.25, 3);
    expect(report.skillScore).toBeCloseTo(0, 3);
  });

  it("credits real skill with a positive skill score", () => {
    const report = computeCalibration([...samples(0.95, 50, 1), ...samples(0.05, 50, 0)]);
    expect(report.brierScore).toBeLessThan(0.01);
    expect(report.skillScore).toBeGreaterThan(0.9);
  });

  it("weights calibration error by bucket population", () => {
    // One stray badly-wrong prediction shouldn't outweigh ninety-nine good ones.
    const report = computeCalibration([...samples(0.6, 99, 0.6), ...samples(0.1, 1, 1)]);
    expect(report.meanAbsCalibrationError).toBeLessThan(0.05);
  });

  it("buckets by stated probability", () => {
    const report = computeCalibration([...samples(0.65, 10, 0.6), ...samples(0.85, 10, 0.8)]);
    expect(report.buckets.map((b) => b.label)).toEqual(["60-70%", "80-90%"]);
    expect(report.buckets[0].count).toBe(10);
  });

  it("returns an empty report rather than NaN when there is nothing to score", () => {
    const report = computeCalibration([]);
    expect(report).toMatchObject({ sampleCount: 0, brierScore: null, meanAbsCalibrationError: null });
  });

  it("ignores malformed rows", () => {
    const report = computeCalibration([
      { probability: 1.5, outcome: 1 },
      { probability: Number.NaN, outcome: 0 },
      { probability: 0.6, outcome: 1 },
    ]);
    expect(report.sampleCount).toBe(1);
  });

  it("returns a null skill score when every outcome went the same way", () => {
    expect(computeCalibration(samples(0.8, 20, 1)).skillScore).toBeNull();
  });
});

describe("computeCategoryPerformance", () => {
  it("breaks performance down by topic, most-sampled first", () => {
    const result = computeCategoryPerformance([
      ...samples(0.7, 20, 0.75, "crypto"),
      ...samples(0.7, 10, 0.3, "sports"),
    ]);
    expect(result[0]).toMatchObject({ category: "crypto", count: 20 });
    expect(result[0].winRate).toBeCloseTo(0.75, 2);
    expect(result[1]).toMatchObject({ category: "sports", count: 10 });
    // The point of the breakdown: one topic is being lost consistently while the global rate looks fine.
    expect(result[1].winRate).toBeLessThan(result[0].winRate);
  });

  it("groups rows with no category rather than dropping them", () => {
    const result = computeCategoryPerformance(samples(0.5, 4, 0.5));
    expect(result[0].category).toBe("uncategorized");
  });
});

describe("passthrough accounting", () => {
  /** n samples that hand back exactly the price they were shown. */
  function copied(p: number, n: number, winRate: number): CalibrationSample[] {
    return samples(p, n, winRate).map((sample) => ({ ...sample, shownPrice: p }));
  }

  it("reports what share of the record is the market's forecast wearing the model's name", () => {
    const report = computeCalibration([...copied(0.7, 30, 0.7), ...samples(0.4, 10, 0.4).map((s) => ({ ...s, shownPrice: 0.55 }))]);
    expect(report.passthroughShare).toBeCloseTo(0.75, 2);
  });

  it("leaves the share null when no sample records the price it was shown", () => {
    expect(computeCalibration(samples(0.6, 20, 0.6)).passthroughShare).toBeNull();
  });

  it("can exclude copied estimates so the remainder measures the model", () => {
    const mixed = [...copied(0.7, 30, 0.7), ...samples(0.4, 10, 0.4).map((s) => ({ ...s, shownPrice: 0.55 }))];
    const report = computeCalibration(mixed, { excludePassthrough: true });
    expect(report.sampleCount).toBe(10);
    expect(report.excludedAsPassthrough).toBe(30);
  });
});

describe("detectAssignmentInversion", () => {
  it("stays quiet on a merely badly calibrated forecaster", () => {
    // Overconfident in the ordinary way: actual rates sit between the stated
    // probability and the base rate, never on the other side of 0.5.
    const report = computeCalibration([...samples(0.8, 60, 0.6), ...samples(0.2, 60, 0.35)]);
    expect(detectAssignmentInversion(report).inverted).toBe(false);
  });

  it("stays quiet on a perfectly calibrated one", () => {
    const report = computeCalibration([...samples(0.75, 80, 0.75), ...samples(0.25, 80, 0.25)]);
    expect(detectAssignmentInversion(report).inverted).toBe(false);
  });

  it("fires on the production signature: mid bands tracking 1−p", () => {
    // Reproduces the shape the live dashboard reported over 499 scored predictions —
    // outcomes called ~35% happening 64% of the time and ~65% happening 36%, which is
    // 1−p to within a point, and is what probabilities recorded against the wrong side
    // of a market look like.
    const report = computeCalibration([
      ...samples(0.35, 101, 0.64),
      ...samples(0.65, 102, 0.36),
      ...samples(0.25, 36, 0.94),
      ...samples(0.75, 35, 0.06),
    ]);

    const inversion = detectAssignmentInversion(report);
    expect(inversion.inverted).toBe(true);
    expect(inversion.invertedShare).toBe(1);
    expect(inversion.detail).toContain("wrong outcome");
  });

  it("ignores bands too close to 0.5 to tell the two hypotheses apart", () => {
    // Flipping 0.48 gives 0.52; no amount of data there can distinguish anything.
    const report = computeCalibration([...samples(0.48, 200, 0.52), ...samples(0.52, 200, 0.48)]);
    const inversion = detectAssignmentInversion(report);
    expect(inversion.sampleCount).toBe(0);
    expect(inversion.inverted).toBe(false);
  });

  it("will not call inversion on a sample too small to mean it", () => {
    const report = computeCalibration([...samples(0.3, 6, 0.83), ...samples(0.7, 6, 0.17)]);
    const inversion = detectAssignmentInversion(report);
    expect(inversion.invertedShare).toBe(1);
    expect(inversion.inverted).toBe(false);
  });
});
