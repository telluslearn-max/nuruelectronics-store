import { describe, expect, it } from "vitest";
import { ensembleProbabilities, median, type ProbabilitySample } from "./ensemble";

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
