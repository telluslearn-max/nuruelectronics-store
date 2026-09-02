import { describe, expect, it } from "vitest";
import { rankAlternatives } from "./alternatives";
import type { ScoredCandidate } from "./rank";

const target: ScoredCandidate = {
  handle: "pixel-9-pro",
  components: { camera: 95, battery: 85, performance: 88, display: 90 },
};

const closeAlt: ScoredCandidate = {
  handle: "pixel-9a",
  components: { camera: 88, battery: 84, performance: 78, display: 82 },
};
const weakCamera: ScoredCandidate = {
  handle: "budget-phone",
  components: { camera: 55, battery: 92, performance: 50, display: 70 },
};

describe("rankAlternatives", () => {
  it("ranks by how much of the target's weighted capability each candidate retains", () => {
    const matches = rankAlternatives(target, [weakCamera, closeAlt], { camera: 5, battery: 2 });
    expect(matches.map((m) => m.handle)).toEqual(["pixel-9a", "budget-phone"]);
    expect(matches[0].matchScore).toBeGreaterThan(matches[1].matchScore);
  });

  it("marks a candidate that retains ≥90% of a camera-first shopper's requirement as meeting the threshold", () => {
    // camera weight 1.0; closeAlt camera 88 / target 95 = 0.926 → meets 0.9
    const [match] = rankAlternatives(target, [closeAlt], { camera: 1 });
    expect(match.matchScore).toBeCloseTo(0.93, 2);
    expect(match.meetsThreshold).toBe(true);
  });

  it("does not over-credit a candidate that beats the target on a component", () => {
    const strongBattery: ScoredCandidate = { handle: "big-batt", components: { camera: 95, battery: 100 } };
    const [match] = rankAlternatives(target, [strongBattery], { camera: 1, battery: 1 });
    // battery ratio capped at 1.0 despite 100 > 85; camera ratio 1.0 → matchScore 1.0, not >1
    expect(match.matchScore).toBe(1);
  });

  it("lists weighted components where the candidate falls clearly short", () => {
    const [match] = rankAlternatives(target, [weakCamera], { camera: 3, battery: 1 });
    expect(match.shortfalls).toContain("camera");
    expect(match.shortfalls).not.toContain("battery"); // 92 vs 85 — no shortfall
  });

  it("falls back to all of the target's scored components when no weights are given", () => {
    const matches = rankAlternatives(target, [closeAlt, weakCamera], {});
    expect(matches[0].handle).toBe("pixel-9a");
    expect(matches[0].matchScore).toBeGreaterThan(0);
  });

  it("excludes the target itself from its own alternatives", () => {
    const matches = rankAlternatives(target, [target, closeAlt], { camera: 1 });
    expect(matches.map((m) => m.handle)).toEqual(["pixel-9a"]);
  });
});
