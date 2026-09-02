import { describe, expect, it } from "vitest";
import { computeFitScore, normalizeWeights } from "./fit-score";

describe("normalizeWeights", () => {
  it("rescales positive weights to sum to 1", () => {
    expect(normalizeWeights({ camera: 40, battery: 30, display: 10, performance: 10, value: 10 })).toEqual({
      camera: 0.4,
      battery: 0.3,
      display: 0.1,
      performance: 0.1,
      value: 0.1,
    });
  });

  it("drops zero and negative weights", () => {
    expect(normalizeWeights({ camera: 2, battery: 0, performance: -1 })).toEqual({ camera: 1 });
  });

  it("returns {} when nothing is positive", () => {
    expect(normalizeWeights({})).toEqual({});
    expect(normalizeWeights({ camera: 0, battery: -5 })).toEqual({});
  });
});

describe("computeFitScore", () => {
  it("is the weighted average of the shopper's priorities", () => {
    // camera 60 @ 0.4, battery 90 @ 0.3, value 50 @ 0.3 = 24 + 27 + 15 = 66
    const result = computeFitScore(
      { camera: 60, battery: 90, value: 50 },
      { camera: 4, battery: 3, value: 3 },
    );
    expect(result.fitScore).toBe(66);
    expect(result.coverage).toBe(1);
    expect(result.weightedComponents.sort()).toEqual(["battery", "camera", "value"]);
  });

  it("renormalizes over the weighted components the product actually has data for", () => {
    // Shopper weights camera 0.4 / battery 0.3 / value 0.3, but product has no value score.
    // Renormalize camera+battery to 0.4/0.7 and 0.3/0.7: 60*(4/7) + 90*(3/7) = 34.29 + 38.57 = 72.86
    const result = computeFitScore({ camera: 60, battery: 90 }, { camera: 4, battery: 3, value: 3 });
    expect(result.fitScore).toBeCloseTo(72.86, 1);
    expect(result.coverage).toBe(0.7);
    expect(result.weightedComponents.sort()).toEqual(["battery", "camera"]);
  });

  it("returns a null fit score when the product has none of the weighted components", () => {
    const result = computeFitScore({ display: 80 }, { camera: 1, battery: 1 });
    expect(result).toEqual({ fitScore: null, weightedComponents: [], coverage: 0 });
  });

  it("returns a null fit score when the shopper gave no usable weights", () => {
    expect(computeFitScore({ camera: 80 }, {}).fitScore).toBeNull();
  });
});
