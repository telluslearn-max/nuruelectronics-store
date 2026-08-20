import { describe, expect, it } from "vitest";
import { computeCalibration, computeCategoryPerformance, type CalibrationSample } from "./calibration";

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
    expect(report.meanAbsCalibrationError).toBeCloseTo(0.4, 2);
    expect(report.buckets[0].gap).toBeCloseTo(0.4, 2);
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
