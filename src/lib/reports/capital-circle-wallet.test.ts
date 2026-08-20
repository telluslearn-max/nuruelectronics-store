import { describe, expect, it } from "vitest";
import { computeDiscrepancyUsd } from "./capital-circle-wallet";

describe("computeDiscrepancyUsd", () => {
  it("returns null for an exact match", () => {
    expect(computeDiscrepancyUsd(100, 100)).toBeNull();
  });

  it("returns null for a tiny gap within the floor threshold ($0.01)", () => {
    expect(computeDiscrepancyUsd(0.5, 0.505)).toBeNull();
  });

  it("returns null for a gap within the 0.5% relative threshold on a larger balance", () => {
    // 0.5% of 1000 = 5.00; a $4 gap should stay below the flag threshold
    expect(computeDiscrepancyUsd(1000, 996)).toBeNull();
  });

  it("flags a gap past the relative threshold, signed onchain-minus-circle", () => {
    // 0.5% of 1000 = 5.00; a $10 gap should flag
    expect(computeDiscrepancyUsd(1000, 990)).toBe(10);
  });

  it("flags a gap past the floor threshold even on a tiny balance", () => {
    expect(computeDiscrepancyUsd(0.5, 0.3)).toBeCloseTo(0.2, 5);
  });

  it("is negative when Circle reports more than the chain shows", () => {
    expect(computeDiscrepancyUsd(990, 1000)).toBe(-10);
  });
});
