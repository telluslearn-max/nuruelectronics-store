import { describe, expect, it } from "vitest";
import { evaluatePolicy, splitChronologically, sweepPolicies, sweepPoliciesHonestly, type LabeledCandidate } from "./policy-eval";

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

describe("splitChronologically", () => {
  const at = (day: number) => new Date(`2026-08-${String(day).padStart(2, "0")}T00:00:00Z`);

  it("puts earlier resolutions in train and later ones in validate, whatever order they arrive", () => {
    const rows = [{ resolvedAt: at(5) }, { resolvedAt: at(1) }, { resolvedAt: at(9) }, { resolvedAt: at(3) }];
    const { train, validate } = splitChronologically(rows, 0.5);
    expect(train.map((r) => r.resolvedAt)).toEqual([at(1), at(3)]);
    expect(validate.map((r) => r.resolvedAt)).toEqual([at(5), at(9)]);
  });

  it("sorts undated rows last rather than guessing a position for them", () => {
    // Guessing would leak later markets into the slice the parameters are chosen on,
    // which is the exact thing the split exists to prevent.
    const rows = [{ resolvedAt: null }, { resolvedAt: at(2) }, { resolvedAt: at(1) }];
    const { train } = splitChronologically(rows, 0.67);
    expect(train.map((r) => r.resolvedAt)).toEqual([at(1), at(2)]);
  });
});

describe("sweepPoliciesHonestly", () => {
  const at = (i: number) => new Date(2026, 7, 1 + Math.floor(i / 4));

  /** Candidates whose outcomes are pure noise — no threshold can genuinely profit from these. */
  function noiseRows(n: number): LabeledCandidate[] {
    return Array.from({ length: n }, (_, i) =>
      candidate({
        marketId: `m${i}`,
        tokenId: `t${i}`,
        modelProbability: 0.55 + ((i * 7) % 40) / 100,
        bestAsk: 0.5,
        outcome: (i % 2) as 0 | 1,
        resolvedAt: at(i),
      }),
    );
  }

  it("carries the best training cell through to data it was not chosen on", () => {
    const result = sweepPoliciesHonestly(noiseRows(200), {
      capUsd: 25,
      bankrollUsd: 500,
      minEdges: [0.02, 0.08],
      lambdas: [0.35, 1],
    });

    expect(result.combinationsTried).toBe(4);
    expect(result.trainCount + result.validateCount).toBe(200);
    expect(result.selected).not.toBeNull();
    // The held-out number is computed on later markets, not on the ones that chose the cell.
    expect(result.selected?.validate.tradeCount).toBeGreaterThan(0);
    expect(result.caveat).toContain("4 parameter combinations");
  });

  it("refuses to endorse a cell that traded too little to mean anything", () => {
    // The live report's top row was 11 trades at a 100% win rate, which is eleven coin
    // flips landing the same way and reads as overwhelming evidence in a ranked table.
    const rows: LabeledCandidate[] = Array.from({ length: 12 }, (_, i) =>
      candidate({ marketId: `m${i}`, tokenId: `t${i}`, modelProbability: 0.95, bestAsk: 0.5, outcome: 1, resolvedAt: at(i) }),
    );

    const result = sweepPoliciesHonestly(rows, { capUsd: 25, bankrollUsd: 500, minEdges: [0.02], lambdas: [1] });
    expect(result.selected).toBeNull();
    expect(result.caveat).toContain("nothing here has enough behind it to act on");
    expect(result.caveat).toContain("not what they earn");
  });

  it("flags a winner that traded enough in training but barely at all out of sample", () => {
    // The other way a thin result sneaks through: the training slice looks substantial and
    // the held-out one has almost nothing in it, so the confirmation is not a confirmation.
    const rows: LabeledCandidate[] = Array.from({ length: 100 }, (_, i) =>
      candidate({
        marketId: `m${i}`,
        tokenId: `t${i}`,
        // Only the training slice carries any edge at all; later candidates are priced at the model's number.
        modelProbability: i < 80 ? 0.9 : 0.5,
        bestAsk: 0.5,
        outcome: 1,
        resolvedAt: at(i),
      }),
    );

    const result = sweepPoliciesHonestly(rows, { capUsd: 25, bankrollUsd: 500, minEdges: [0.02], lambdas: [1], trainShare: 0.8 });
    expect(result.selected?.validate.tradeCount).toBeLessThan(20);
    expect(result.caveat).toContain("unverified");
  });

  it("says plainly when the in-sample winner did not survive out of sample", () => {
    // Wins concentrated entirely in the training slice, losses entirely after it — the
    // textbook shape of a threshold fitted to noise.
    const rows: LabeledCandidate[] = Array.from({ length: 120 }, (_, i) =>
      candidate({
        marketId: `m${i}`,
        tokenId: `t${i}`,
        modelProbability: 0.9,
        bestAsk: 0.5,
        outcome: (i < 72 ? 1 : 0) as 0 | 1,
        resolvedAt: at(i),
      }),
    );

    const result = sweepPoliciesHonestly(rows, { capUsd: 25, bankrollUsd: 500, minEdges: [0.02], lambdas: [1], trainShare: 0.6 });
    expect(result.selected?.train.returnOnStake ?? 0).toBeGreaterThan(0);
    expect(result.selected?.validate.returnOnStake ?? 0).toBeLessThan(0);
    expect(result.caveat).toContain("did not hold up out of sample");
  });
});
