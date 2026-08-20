import { describe, expect, it } from "vitest";
import { evaluatePolicy, sweepPolicies, type LabeledCandidate } from "./policy-eval";

const PARAMS = { minEdge: 0.05, lambda: 1, capUsd: 25, bankrollUsd: 500 };

function candidate(overrides: Partial<LabeledCandidate> & { outcome: 0 | 1 }): LabeledCandidate {
  return {
    marketId: "m",
    tokenId: "t",
    modelProbability: 0.8,
    bestAsk: 0.5,
    ...overrides,
  };
}

describe("evaluatePolicy", () => {
  it("trades only candidates that clear the edge threshold", () => {
    const result = evaluatePolicy(
      [
        candidate({ modelProbability: 0.9, bestAsk: 0.5, outcome: 1 }), // big edge
        candidate({ modelProbability: 0.52, bestAsk: 0.5, outcome: 1 }), // no edge
      ],
      PARAMS,
    );
    expect(result.tradeCount).toBe(1);
  });

  it("prices wins at the ask, so payoff matches what settlement would compute", () => {
    // Shrinkage off (λ=1): p=0.9 at ask 0.5 → f*=(0.9-0.5)/0.5=0.8 → 0.25*0.8*500=$100, capped at $25.
    // $25 of shares at 0.50 pays $50 → +$25.
    const result = evaluatePolicy([candidate({ modelProbability: 0.9, bestAsk: 0.5, outcome: 1 })], PARAMS);
    expect(result.stakedUsd).toBe(25);
    expect(result.pnlUsd).toBeCloseTo(25, 2);
  });

  it("loses the full stake on a losing outcome", () => {
    const result = evaluatePolicy([candidate({ modelProbability: 0.9, bestAsk: 0.5, outcome: 0 })], PARAMS);
    expect(result.pnlUsd).toBeCloseTo(-25, 2);
    expect(result.returnOnStake).toBeCloseTo(-1, 4);
  });

  it("skips candidates priced outside the tradeable band", () => {
    const result = evaluatePolicy([candidate({ modelProbability: 1, bestAsk: 0.99, outcome: 1 })], PARAMS);
    expect(result.tradeCount).toBe(0);
  });

  it("skips candidates with no usable price", () => {
    const result = evaluatePolicy([candidate({ bestAsk: null, midpoint: null, outcome: 1 })], PARAMS);
    expect(result.tradeCount).toBe(0);
  });

  it("shrinkage changes which candidates qualify — the parameter worth sweeping", () => {
    const rows = [candidate({ modelProbability: 0.75, bestAsk: 0.6, outcome: 1 })];
    const trusting = evaluatePolicy(rows, { ...PARAMS, lambda: 1 });
    const sceptical = evaluatePolicy(rows, { ...PARAMS, lambda: 0.15 });
    expect(trusting.tradeCount).toBe(1);
    expect(sceptical.tradeCount).toBe(0);
  });

  it("reports zeroes rather than NaN when a policy trades nothing", () => {
    const result = evaluatePolicy([candidate({ modelProbability: 0.5, bestAsk: 0.5, outcome: 1 })], PARAMS);
    expect(result).toMatchObject({ tradeCount: 0, pnlUsd: 0, winRate: 0, returnOnStake: null });
  });

  it("separates an overconfident model's expectation from its realized result", () => {
    // Ten identical high-edge bets, only three of which land.
    const rows: LabeledCandidate[] = Array.from({ length: 10 }, (_, i) =>
      candidate({ marketId: `m${i}`, tokenId: `t${i}`, modelProbability: 0.9, bestAsk: 0.5, outcome: (i < 3 ? 1 : 0) as 0 | 1 }),
    );
    const result = evaluatePolicy(rows, PARAMS);
    expect(result.meanExpectedEdge).toBeGreaterThan(0.3);
    expect(result.realizedEdge).toBeLessThan(0);
    expect(result.winRate).toBeCloseTo(0.3, 4);
  });
});

describe("sweepPolicies", () => {
  it("covers the full grid and ranks by return on stake", () => {
    const rows: LabeledCandidate[] = Array.from({ length: 20 }, (_, i) =>
      candidate({ marketId: `m${i}`, tokenId: `t${i}`, modelProbability: 0.7 + (i % 3) * 0.1, bestAsk: 0.5, outcome: (i % 2) as 0 | 1 }),
    );
    const results = sweepPolicies(rows, { capUsd: 25, bankrollUsd: 500, minEdges: [0.02, 0.1], lambdas: [0.35, 1] });
    expect(results).toHaveLength(4);
    const returns = results.map((r) => r.returnOnStake ?? -Infinity);
    expect([...returns].sort((a, b) => b - a)).toEqual(returns);
  });

  it("shows a stricter threshold trading strictly fewer candidates", () => {
    const rows: LabeledCandidate[] = Array.from({ length: 10 }, (_, i) =>
      candidate({ marketId: `m${i}`, tokenId: `t${i}`, modelProbability: 0.6 + i * 0.03, bestAsk: 0.5, outcome: 1 }),
    );
    const [loose] = sweepPolicies(rows, { capUsd: 25, bankrollUsd: 500, minEdges: [0.02], lambdas: [1] });
    const [strict] = sweepPolicies(rows, { capUsd: 25, bankrollUsd: 500, minEdges: [0.15], lambdas: [1] });
    expect(strict.tradeCount).toBeLessThan(loose.tradeCount);
  });
});
