import { describe, expect, it } from "vitest";
import { rankByFit, type ScoredCandidate } from "./rank";

const pixel: ScoredCandidate = { handle: "pixel-9a", components: { camera: 92, battery: 88, performance: 70, value: 85 } };
const samsung: ScoredCandidate = { handle: "galaxy-s25", components: { camera: 84, battery: 82, performance: 91, value: 62 } };
const budget: ScoredCandidate = { handle: "redmi-note", components: { camera: 55, battery: 90, performance: 48, value: 95 } };

describe("rankByFit", () => {
  it("orders a camera+battery-first shopper's picks by Fit Score", () => {
    const ranked = rankByFit([samsung, pixel, budget], { camera: 4, battery: 3, value: 1, performance: 1 });
    expect(ranked.map((r) => r.handle)).toEqual(["pixel-9a", "galaxy-s25", "redmi-note"]);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].fitScore).toBeGreaterThan(ranked[1].fitScore!);
  });

  it("reorders the same products for a performance-first shopper", () => {
    const ranked = rankByFit([pixel, samsung, budget], { performance: 5, display: 2, battery: 1 });
    expect(ranked[0].handle).toBe("galaxy-s25");
  });

  it("sends products with no evaluable weighted component to the end", () => {
    const noCameraData: ScoredCandidate = { handle: "mystery", components: { performance: 99 } };
    const ranked = rankByFit([noCameraData, pixel], { camera: 1 });
    expect(ranked.map((r) => r.handle)).toEqual(["pixel-9a", "mystery"]);
    expect(ranked[1].fitScore).toBeNull();
    expect(ranked[1].rank).toBe(2);
  });
});
