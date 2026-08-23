import { describe, expect, it } from "vitest";
import {
  ensembleProbabilities,
  extremizeEstimates,
  extremizeProbability,
  measureMarketAnchoring,
  median,
  type EnsembledEstimate,
  type ProbabilitySample,
} from "./ensemble";

/** Minimal EnsembledEstimate builder for the extremization tests below — only marketId/tokenId/probability matter. */
const estimate = (marketId: string, tokenId: string, probability: number, extra: Partial<EnsembledEstimate> = {}): EnsembledEstimate => ({
  marketId,
  tokenId,
  probability,
  disagreement: 0,
  sampleCount: 1,
  samples: [probability],
  rationale: null,
  ...extra,
});

const sample = (tokenId: string, probability: number, rationale?: string): ProbabilitySample => ({
  marketId: `market-${tokenId}`,
  tokenId,
  probability,
  rationale,
});

describe("median", () => {
  it("handles odd and even counts", () => {
    expect(median([0.1, 0.9, 0.5])).toBe(0.5);
    expect(median([0.2, 0.4, 0.6, 0.8])).toBeCloseTo(0.5, 10);
  });

  it("is order-independent", () => {
    expect(median([0.9, 0.1, 0.5])).toBe(median([0.1, 0.5, 0.9]));
  });

  it("returns 0 for an empty set rather than NaN", () => {
    expect(median([])).toBe(0);
  });
});

describe("ensembleProbabilities", () => {
  it("collapses samples per token to their median", () => {
    const result = ensembleProbabilities([[sample("t1", 0.6)], [sample("t1", 0.65)], [sample("t1", 0.55)]]);
    expect(result).toHaveLength(1);
    expect(result[0].probability).toBeCloseTo(0.6, 10);
    expect(result[0].sampleCount).toBe(3);
  });

  it("suppresses a single hallucinated outlier — the reason ensembling exists here", () => {
    // One sample claims near-certainty on a market the other two price near the crowd.
    const result = ensembleProbabilities([[sample("t1", 0.55)], [sample("t1", 0.98)], [sample("t1", 0.57)]]);
    expect(result[0].probability).toBeCloseTo(0.57, 10);
    expect(result[0].disagreement).toBeCloseTo(0.43, 10);
  });

  it("reports disagreement so an unstable estimate can be excluded downstream", () => {
    const stable = ensembleProbabilities([[sample("t1", 0.6)], [sample("t1", 0.62)], [sample("t1", 0.58)]]);
    expect(stable[0].disagreement).toBeCloseTo(0.04, 10);
  });

  it("drops malformed samples rather than clamping them into a belief", () => {
    const result = ensembleProbabilities([
      [sample("t1", 0.6)],
      [sample("t1", Number.NaN)],
      [sample("t1", 1.5)],
      [sample("t1", -0.2)],
    ]);
    expect(result[0].sampleCount).toBe(1);
    expect(result[0].probability).toBeCloseTo(0.6, 10);
  });

  it("keeps tokens separate and preserves the first rationale", () => {
    const result = ensembleProbabilities([
      [sample("t1", 0.6, "because A"), sample("t2", 0.3)],
      [sample("t1", 0.7, "because B"), sample("t2", 0.35)],
    ]);
    const t1 = result.find((r) => r.tokenId === "t1");
    const t2 = result.find((r) => r.tokenId === "t2");
    expect(t1?.rationale).toBe("because A");
    expect(t1?.probability).toBeCloseTo(0.65, 10);
    expect(t2?.probability).toBeCloseTo(0.325, 10);
  });

  it("ignores entries missing identifiers, and returns nothing for empty input", () => {
    expect(ensembleProbabilities([])).toEqual([]);
    const result = ensembleProbabilities([[{ marketId: "", tokenId: "", probability: 0.5 }]]);
    expect(result).toEqual([]);
  });
});

describe("measureMarketAnchoring", () => {
  const prices = new Map([
    ["a", 0.62],
    ["b", 0.31],
    ["c", 0.055],
  ]);

  it("catches a model handing back the prices it was shown", () => {
    // The real production failure: 96 of 96 outcomes returned byte-identical to the input price,
    // across three independent samples at temperature 0.7. Nothing else in the pipeline can see
    // it — the estimates parse, the ensemble agrees perfectly because every sample is the same
    // number, and edge lands at exactly minus costs on every candidate.
    const result = measureMarketAnchoring(
      [
        { tokenId: "a", probability: 0.62 },
        { tokenId: "b", probability: 0.31 },
        { tokenId: "c", probability: 0.055 },
      ],
      prices,
    );
    expect(result).toEqual({ compared: 3, copied: 3, share: 1 });
  });

  it("treats a rounded copy of the price as a copy", () => {
    const result = measureMarketAnchoring([{ tokenId: "a", probability: 0.6203 }], prices);
    expect(result.copied).toBe(1);
  });

  it("does not flag a genuine forecast that happens to sit near the price", () => {
    const result = measureMarketAnchoring(
      [
        { tokenId: "a", probability: 0.66 },
        { tokenId: "b", probability: 0.2 },
      ],
      prices,
    );
    expect(result).toMatchObject({ compared: 2, copied: 0, share: 0 });
  });

  it("ignores estimates with no matching market price rather than counting them either way", () => {
    const result = measureMarketAnchoring(
      [
        { tokenId: "a", probability: 0.62 },
        { tokenId: "unknown", probability: 0.5 },
      ],
      prices,
    );
    expect(result).toEqual({ compared: 1, copied: 1, share: 1 });
  });

  it("reports a zero share rather than dividing by nothing when there is no overlap", () => {
    expect(measureMarketAnchoring([], prices)).toEqual({ compared: 0, copied: 0, share: 0 });
  });
});

describe("extremizeProbability", () => {
  it("is the identity at d=1 — ships inert by default", () => {
    expect(extremizeProbability(0.7, 1)).toBeCloseTo(0.7, 10);
    expect(extremizeProbability(0.12, 1)).toBeCloseTo(0.12, 10);
  });

  it("pushes a probability away from 0.5 when d > 1", () => {
    const result = extremizeProbability(0.7, 1.3);
    expect(result).toBeGreaterThan(0.7);
    expect(result).toBeLessThan(1);
  });

  it("pulls a probability toward 0.5 when d < 1", () => {
    const result = extremizeProbability(0.7, 0.5);
    expect(result).toBeLessThan(0.7);
    expect(result).toBeGreaterThan(0.5);
  });

  it("is symmetric around 0.5 — extremizing 0.3 and 0.7 by the same d moves them equal and opposite", () => {
    const up = extremizeProbability(0.7, 1.3) - 0.7;
    const down = 0.3 - extremizeProbability(0.3, 1.3);
    expect(up).toBeCloseTo(down, 10);
  });

  it("leaves the boundaries alone rather than computing an infinite logit", () => {
    expect(extremizeProbability(0, 1.3)).toBe(0);
    expect(extremizeProbability(1, 1.3)).toBe(1);
  });

  it("never leaves the [0,1] range for any d", () => {
    expect(extremizeProbability(0.99, 5)).toBeLessThanOrEqual(1);
    expect(extremizeProbability(0.01, 5)).toBeGreaterThanOrEqual(0);
  });
});

describe("extremizeEstimates", () => {
  it("is a true no-op at d=1 — same array reference, not just equal values", () => {
    const estimates = [estimate("m1", "t1", 0.6)];
    expect(extremizeEstimates(estimates, 1)).toBe(estimates);
  });

  it("extremizes every estimate's probability, leaving other fields untouched", () => {
    const original = estimate("m1", "t1", 0.7, { disagreement: 0.05, sampleCount: 3, samples: [0.65, 0.7, 0.75], rationale: "because" });
    const [result] = extremizeEstimates([original], 1.3);
    expect(result.probability).toBeGreaterThan(0.7);
    expect(result.disagreement).toBe(0.05);
    expect(result.sampleCount).toBe(3);
    expect(result.samples).toEqual([0.65, 0.7, 0.75]);
    expect(result.rationale).toBe("because");
  });
});
