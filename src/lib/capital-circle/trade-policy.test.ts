import { describe, expect, it } from "vitest";
import {
  applyCaps,
  computeAdaptiveShrinkage,
  computeSettlement,
  effectiveEntryPrice,
  evaluateEdge,
  computeUrgency,
  disagreementAdjustedLambda,
  evaluateExit,
  kellySize,
  requiredDeviation,
  selectTrades,
  shrinkProbability,
} from "./trade-policy";
// Derived from config rather than hardcoded: these assertions are about behaviour, and
// re-tuning a threshold should not read as a broken test.
import { COST_BUFFER, KELLY_FRACTION, KELLY_SHRINKAGE, MAX_ENTRY_PRICE } from "./config";

describe("effectiveEntryPrice", () => {
  it("prefers the ask, because the ask is what a taker actually pays", () => {
    expect(effectiveEntryPrice({ bestAsk: 0.62, midpoint: 0.6, spread: 0.04 })).toBe(0.62);
  });

  it("falls back to mid plus half the spread when there is no ask", () => {
    expect(effectiveEntryPrice({ bestAsk: null, midpoint: 0.6, spread: 0.04 })).toBeCloseTo(0.62, 10);
  });

  it("falls back to a flat spread assumption when neither ask nor spread is known", () => {
    expect(effectiveEntryPrice({ midpoint: 0.6 })).toBeCloseTo(0.61, 10);
  });

  it("returns null when there is no usable price at all", () => {
    expect(effectiveEntryPrice({ bestAsk: null, midpoint: null })).toBeNull();
    expect(effectiveEntryPrice({ midpoint: 0 })).toBeNull();
  });
});

describe("shrinkProbability", () => {
  it("interpolates between the model estimate and the market price", () => {
    expect(shrinkProbability(0.9, 0.5, 0.5)).toBeCloseTo(0.7, 10);
    expect(shrinkProbability(0.9, 0.5, 0)).toBeCloseTo(0.5, 10);
    expect(shrinkProbability(0.9, 0.5, 1)).toBeCloseTo(0.9, 10);
  });

  it("clamps nonsense inputs instead of propagating them into a size", () => {
    expect(shrinkProbability(1.8, 0.5, 1)).toBe(1);
    expect(shrinkProbability(Number.NaN, 0.5, 1)).toBe(0);
  });
});

describe("disagreementAdjustedLambda", () => {
  it("leaves a unanimous estimate at full trust", () => {
    expect(disagreementAdjustedLambda(0.5, 0, 0.25)).toBeCloseTo(0.5, 10);
    expect(disagreementAdjustedLambda(0.5, null, 0.25)).toBeCloseTo(0.5, 10);
    expect(disagreementAdjustedLambda(0.5, undefined, 0.25)).toBeCloseTo(0.5, 10);
  });

  it("falls to zero exactly where the hard filter already rejected, so the cliff becomes a ramp", () => {
    expect(disagreementAdjustedLambda(0.5, 0.25, 0.25)).toBe(0);
    expect(disagreementAdjustedLambda(0.5, 0.4, 0.25)).toBe(0);
  });

  it("scales linearly in between — no new tunable, anchored on the existing threshold", () => {
    expect(disagreementAdjustedLambda(0.5, 0.125, 0.25)).toBeCloseTo(0.25, 10);
    expect(disagreementAdjustedLambda(0.6, 0.05, 0.25)).toBeCloseTo(0.48, 10);
  });
});

describe("requiredDeviation", () => {
  /**
   * The identity the whole edge gate reduces to. Worth locking down explicitly because it is
   * invisible in the code that uses it: nothing named MIN_EDGE suggests "the model must disagree
   * with the market by 8 points", and the factor that turns one into the other (λ) moves on its
   * own as calibration is measured.
   */
  it("is the algebraic inverse of the edge formula — edge = λ·Δ − cost", () => {
    for (const lambda of [1, 0.6, 0.5, 0.3, 0.15]) {
      for (const minEdge of [0.03, 0.012]) {
        const delta = requiredDeviation(minEdge, lambda, 0.01) as number;
        // Feeding that deviation back through the real formula lands on the bar. Precision 4
        // rather than exact: requiredDeviation rounds to 4dp on purpose (it is quoted to humans
        // in cycle summaries), which caps the round-trip error at λ×5e-5.
        const entry = 0.5;
        const edge = shrinkProbability(entry + delta, entry, lambda) - entry - 0.01;
        expect(edge).toBeCloseTo(minEdge, 4);
      }
    }
  });

  it("shows the default bar demanding an 8-point disagreement with a liquid market", () => {
    expect(requiredDeviation(0.03, 0.5, 0.01)).toBeCloseTo(0.08, 10);
  });

  it("explodes as measured calibration pulls λ down — the desk switching itself off", () => {
    // A model scored badly enough to earn λ=0.15 would need a 27-point disagreement, which no
    // honest forecast of a deep market produces. That is intended, but it must be legible: this
    // is the number the cycle summary quotes instead of reporting a generic "no edge" hour.
    expect(requiredDeviation(0.03, 0.15, 0.01)).toBeCloseTo(0.2667, 3);
  });

  it("reports null when λ is zero, since no deviation can ever clear the bar", () => {
    expect(requiredDeviation(0.03, 0, 0.01)).toBeNull();
  });

  it("defaults its cost buffer to the configured one", () => {
    expect(requiredDeviation(0.03, 0.5)).toBeCloseTo((0.03 + COST_BUFFER) / 0.5, 10);
  });
});

describe("evaluateEdge", () => {
  it("accepts a large, real divergence from the market", () => {
    const result = evaluateEdge({ modelProbability: 0.9, pricing: { bestAsk: 0.5 }, lambda: 0.5 });
    // shrunk = 0.5*0.9 + 0.5*0.5 = 0.7; edge = 0.7 - 0.5 - 0.01 = 0.19
    expect(result.shrunkProbability).toBeCloseTo(0.7, 10);
    expect(result.edge).toBeCloseTo(0.19, 10);
    expect(result.accepted).toBe(true);
  });

  it("rejects a confident-sounding estimate that shrinkage reveals as no edge", () => {
    // The failure mode the whole gate exists for: model says 0.75 on a 0.70 market.
    const result = evaluateEdge({ modelProbability: 0.75, pricing: { bestAsk: 0.7 }, lambda: 0.35 });
    expect(result.accepted).toBe(false);
    expect(result.edge).toBeLessThan(0.05);
  });

  it("rejects entries outside the tradeable price band even with a nominal edge", () => {
    const result = evaluateEdge({ modelProbability: 1, pricing: { bestAsk: 0.99 }, lambda: 1 });
    expect(result.accepted).toBe(false);
    expect(result.reason).toContain("outside the tradeable band");
  });

  it("refuses to trade when no price is available", () => {
    const result = evaluateEdge({ modelProbability: 0.9, pricing: {} });
    expect(result.accepted).toBe(false);
    expect(result.effectiveEntry).toBeNull();
  });

  it("charges the spread: the same estimate can pass at one ask and fail at a worse one", () => {
    const at = (bestAsk: number) => evaluateEdge({ modelProbability: 0.8, pricing: { bestAsk }, lambda: 1, minEdge: 0.05 });
    // p=0.8: at 0.68 the edge is 0.11, at 0.76 it's 0.03 — the price paid is the whole difference.
    expect(at(0.68).accepted).toBe(true);
    expect(at(0.76).accepted).toBe(false);
  });
});

describe("kellySize", () => {
  it("sizes proportionally to edge", () => {
    const small = kellySize({ shrunkProbability: 0.6, effectiveEntry: 0.5, capUsd: 1000, bankrollUsd: 500 });
    const large = kellySize({ shrunkProbability: 0.8, effectiveEntry: 0.5, capUsd: 1000, bankrollUsd: 500 });
    expect(large.recommendedUsd).toBeGreaterThan(small.recommendedUsd);
    // f* = (0.6-0.5)/(1-0.5) = 0.2, staked as KELLY_FRACTION × f* × bankroll.
    expect(small.recommendedUsd).toBeCloseTo(KELLY_FRACTION * 0.2 * 500, 2);
  });

  it("returns zero when there is no edge to size", () => {
    expect(kellySize({ shrunkProbability: 0.4, effectiveEntry: 0.5, capUsd: 1000, bankrollUsd: 500 }).recommendedUsd).toBe(0);
    expect(kellySize({ shrunkProbability: 0.5, effectiveEntry: 0.5, capUsd: 1000, bankrollUsd: 500 }).recommendedUsd).toBe(0);
  });

  it("clamps to the per-position cap", () => {
    const result = kellySize({ shrunkProbability: 0.95, effectiveEntry: 0.3, capUsd: 25, bankrollUsd: 500 });
    expect(result.recommendedUsd).toBe(25);
    expect(result.reason).toContain("per-position cap");
  });

  it("clamps to a share of resting ask depth so the order never is the whole book", () => {
    const result = kellySize({ shrunkProbability: 0.9, effectiveEntry: 0.3, capUsd: 25, bankrollUsd: 500, bookDepthUsd: 40 });
    expect(result.recommendedUsd).toBe(4);
    expect(result.reason).toContain("resting ask depth");
  });

  it("refuses degenerate entry prices", () => {
    expect(kellySize({ shrunkProbability: 0.9, effectiveEntry: 1, capUsd: 25, bankrollUsd: 500 }).recommendedUsd).toBe(0);
    expect(kellySize({ shrunkProbability: 0.9, effectiveEntry: 0, capUsd: 25, bankrollUsd: 500 }).recommendedUsd).toBe(0);
  });
});

describe("applyCaps", () => {
  it("passes a request that fits under every cap", () => {
    const result = applyCaps({ requestedUsd: 10, perTxCapUsd: 25, windows: [] });
    expect(result).toMatchObject({ approvedUsd: 10, capped: false, reason: null });
  });

  it("binds on the tightest window, not the first", () => {
    const result = applyCaps({
      requestedUsd: 25,
      perTxCapUsd: 25,
      windows: [
        { label: "daily", capUsd: 100, spentUsd: 80 },
        { label: "weekly", capUsd: 200, spentUsd: 195 },
      ],
    });
    expect(result.approvedUsd).toBe(5);
    expect(result.reason).toContain("weekly");
  });

  it("returns zero headroom rather than a negative size", () => {
    const result = applyCaps({ requestedUsd: 25, perTxCapUsd: 25, windows: [{ label: "daily", capUsd: 100, spentUsd: 140 }] });
    expect(result.approvedUsd).toBe(0);
  });

  it("rejects non-positive requests outright", () => {
    expect(applyCaps({ requestedUsd: 0, perTxCapUsd: 25, windows: [] }).approvedUsd).toBe(0);
  });
});

describe("selectTrades", () => {
  const base = {
    question: "q",
    outcome: "Yes",
    pricing: { bestAsk: 0.5 },
  };

  it("ranks a confident small disagreement above a scattered large one", () => {
    // The distinction the old binary filter threw away: both candidates sit on the tolerable
    // side of maxDisagreement, so both used to be scored at identical λ and the noisier one won
    // purely for being further from the price. Distance from the price is only edge if the
    // estimate is reproducible, which is the entire reason the ensemble samples more than once.
    const result = selectTrades({
      candidates: [
        { ...base, marketId: "far-but-noisy", tokenId: "noisy", modelProbability: 0.75, disagreement: 0.22 },
        { ...base, marketId: "near-but-tight", tokenId: "tight", modelProbability: 0.68, disagreement: 0.0 },
      ],
      openMarketIds: new Set(),
      openEventIds: new Set(),
      maxPositions: 1,
      lambda: KELLY_SHRINKAGE,
      minEdge: 0.01,
      maxDisagreement: 0.25,
    });
    expect(result.selected).toHaveLength(1);
    expect(result.selected[0].tokenId).toBe("tight");
  });

  it("still hard-rejects past the threshold, and the ramp reaches zero at the same point", () => {
    const result = selectTrades({
      candidates: [{ ...base, marketId: "m1", tokenId: "t1", modelProbability: 0.95, disagreement: 0.3 }],
      openMarketIds: new Set(),
      openEventIds: new Set(),
      maxPositions: 2,
      lambda: KELLY_SHRINKAGE,
      minEdge: 0.01,
      maxDisagreement: 0.25,
    });
    expect(result.selected).toHaveLength(0);
    expect(result.rejected[0].reason).toContain("disagreed");
  });

  it("takes the highest-edge candidates up to the per-cycle limit", () => {
    const result = selectTrades({
      candidates: [
        { ...base, marketId: "m1", tokenId: "t1", modelProbability: 0.7 },
        { ...base, marketId: "m2", tokenId: "t2", modelProbability: 0.95 },
        { ...base, marketId: "m3", tokenId: "t3", modelProbability: 0.85 },
      ],
      openMarketIds: new Set(),
      openEventIds: new Set(),
      maxPositions: 2,
      lambda: 1,
      maxDisagreement: 0.25,
    });
    expect(result.selected.map((s) => s.marketId)).toEqual(["m2", "m3"]);
    expect(result.rejected[0].reason).toContain("position limit");
  });

  it("never doubles up on a market already held", () => {
    const result = selectTrades({
      candidates: [{ ...base, marketId: "m1", tokenId: "t1", modelProbability: 0.95 }],
      openMarketIds: new Set(["m1"]),
      openEventIds: new Set(),
      maxPositions: 3,
      lambda: 1,
      maxDisagreement: 0.25,
    });
    expect(result.selected).toHaveLength(0);
    expect(result.rejected[0].reason).toContain("Already holding a position in this market");
  });

  it("treats two outcomes of one event as the same wager", () => {
    const result = selectTrades({
      candidates: [
        { ...base, marketId: "m1", tokenId: "t1", eventId: "e1", modelProbability: 0.95 },
        { ...base, marketId: "m2", tokenId: "t2", eventId: "e1", modelProbability: 0.9 },
      ],
      openMarketIds: new Set(),
      openEventIds: new Set(),
      maxPositions: 3,
      lambda: 1,
      maxDisagreement: 0.25,
    });
    expect(result.selected).toHaveLength(1);
    expect(result.rejected[0].reason).toContain("correlated");
  });

  it("drops estimates the ensemble could not agree on", () => {
    const result = selectTrades({
      candidates: [{ ...base, marketId: "m1", tokenId: "t1", modelProbability: 0.95, disagreement: 0.5 }],
      openMarketIds: new Set(),
      openEventIds: new Set(),
      maxPositions: 3,
      lambda: 1,
      maxDisagreement: 0.25,
    });
    expect(result.selected).toHaveLength(0);
    expect(result.rejected[0].reason).toContain("disagreed");
  });

  it("selects nothing when no candidate clears the edge gate", () => {
    const result = selectTrades({
      candidates: [{ ...base, marketId: "m1", tokenId: "t1", modelProbability: 0.52 }],
      openMarketIds: new Set(),
      openEventIds: new Set(),
      maxPositions: 3,
      lambda: 0.35,
      maxDisagreement: 0.25,
    });
    expect(result.selected).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
  });

  describe("categoryLambdas — topic-conditioned trust", () => {
    it("uses a candidate's own category λ instead of the global one when present", () => {
      // Global λ=0.15 (barely trust the model) would reject this; the category's own λ=0.6
      // (genuinely trusted in this topic) should let it through instead.
      const result = selectTrades({
        candidates: [{ ...base, marketId: "m1", tokenId: "t1", category: "politics", modelProbability: 0.65 }],
        openMarketIds: new Set(),
        openEventIds: new Set(),
        maxPositions: 3,
        lambda: 0.15,
        categoryLambdas: { politics: 0.6 },
        minEdge: 0.03,
        maxDisagreement: 0.25,
      });
      expect(result.selected).toHaveLength(1);
      expect(result.selected[0].lambda).toBeCloseTo(0.6, 10);
    });

    it("falls back to the global λ for a category with no entry in the map", () => {
      const result = selectTrades({
        candidates: [{ ...base, marketId: "m1", tokenId: "t1", category: "obscure-topic", modelProbability: 0.65 }],
        openMarketIds: new Set(),
        openEventIds: new Set(),
        maxPositions: 3,
        lambda: 0.5,
        categoryLambdas: { politics: 0.6 },
        maxDisagreement: 0.25,
      });
      expect(result.selected[0].lambda).toBeCloseTo(0.5, 10);
    });

    it("falls back to the global λ for an uncategorized candidate even with a map present", () => {
      const result = selectTrades({
        candidates: [{ ...base, marketId: "m1", tokenId: "t1", modelProbability: 0.65 }], // no category
        openMarketIds: new Set(),
        openEventIds: new Set(),
        maxPositions: 3,
        lambda: 0.5,
        categoryLambdas: { politics: 0.6 },
        maxDisagreement: 0.25,
      });
      expect(result.selected[0].lambda).toBeCloseTo(0.5, 10);
    });

    it("still ranks two candidates by their own category-adjusted edge, not a shared global one", () => {
      // Crypto's own λ (0.1, barely trusted) should push it below politics (0.6, well trusted)
      // even though crypto's raw model probability is further from the price.
      const result = selectTrades({
        candidates: [
          { ...base, marketId: "crypto-market", tokenId: "t1", category: "crypto", modelProbability: 0.9 },
          { ...base, marketId: "politics-market", tokenId: "t2", category: "politics", modelProbability: 0.65 },
        ],
        openMarketIds: new Set(),
        openEventIds: new Set(),
        maxPositions: 1,
        lambda: 0.5,
        categoryLambdas: { crypto: 0.1, politics: 0.6 },
        minEdge: 0.03,
        maxDisagreement: 0.25,
      });
      expect(result.selected).toHaveLength(1);
      expect(result.selected[0].marketId).toBe("politics-market");
    });

    it("omitting categoryLambdas entirely behaves exactly as before — backward compatible", () => {
      const withMap = selectTrades({
        candidates: [{ ...base, marketId: "m1", tokenId: "t1", category: "politics", modelProbability: 0.65 }],
        openMarketIds: new Set(),
        openEventIds: new Set(),
        maxPositions: 3,
        lambda: 0.5,
        maxDisagreement: 0.25,
      });
      expect(withMap.selected[0].lambda).toBeCloseTo(0.5, 10);
    });
  });
});

describe("computeSettlement", () => {
  it("pays out shares at the final price", () => {
    // $10 at 0.50 buys 20 shares; a winner pays 20 - 10 = +$10.
    expect(computeSettlement({ sizeUsd: 10, entryPrice: 0.5, finalPrice: 1 }).resultUsd).toBe(10);
  });

  it("books a full loss when the outcome resolves to zero", () => {
    expect(computeSettlement({ sizeUsd: 10, entryPrice: 0.5, finalPrice: 0 }).resultUsd).toBe(-10);
  });

  it("subtracts modelled costs", () => {
    expect(computeSettlement({ sizeUsd: 10, entryPrice: 0.5, finalPrice: 1, feesUsd: 0.25 }).resultUsd).toBe(9.75);
  });

  it("computes an exact loss even with no entry price", () => {
    expect(computeSettlement({ sizeUsd: 10, entryPrice: null, finalPrice: 0 }).resultUsd).toBe(-10);
  });

  it("books an unrecoverable-entry win conservatively rather than as zero", () => {
    // The old behaviour recorded $0 here, biasing every aggregate downward on winners.
    const result = computeSettlement({ sizeUsd: 10, entryPrice: null, finalPrice: 1 });
    expect(result.resultUsd).toBeGreaterThan(0);
    // Priced at the most expensive entry the policy would ever have allowed.
    expect(result.resultUsd).toBeCloseTo(10 / MAX_ENTRY_PRICE - 10, 2);
    expect(result.note).toContain("unrecoverable");
  });
});

describe("evaluateExit", () => {
  it("takes profit once the price is near certain", () => {
    const result = evaluateExit({ entryPrice: 0.5, currentPrice: 0.96, takeProfitPrice: 0.95, stopLossFraction: 0.5 });
    expect(result).toMatchObject({ shouldExit: true, reason: "take_profit" });
  });

  it("stops out when the price halves against the entry", () => {
    const result = evaluateExit({ entryPrice: 0.6, currentPrice: 0.29, takeProfitPrice: 0.95, stopLossFraction: 0.5 });
    expect(result).toMatchObject({ shouldExit: true, reason: "stop" });
  });

  it("holds inside the band", () => {
    const result = evaluateExit({ entryPrice: 0.6, currentPrice: 0.55, takeProfitPrice: 0.95, stopLossFraction: 0.5 });
    expect(result.shouldExit).toBe(false);
  });

  it("can still take profit with no entry price on record", () => {
    expect(evaluateExit({ entryPrice: null, currentPrice: 0.97, takeProfitPrice: 0.95, stopLossFraction: 0.5 }).shouldExit).toBe(true);
    expect(evaluateExit({ entryPrice: null, currentPrice: 0.2, takeProfitPrice: 0.95, stopLossFraction: 0.5 }).shouldExit).toBe(false);
  });
});

describe("computeUrgency", () => {
  const base = {
    dailyTarget: 1,
    baseMinEdge: 0.03,
    hungryMinEdge: 0.012,
    hungryAfterHours: 6,
    starvingAfterHours: 20,
  };

  it("holds the strict bar once the daily target is met", () => {
    const result = computeUrgency({ ...base, hoursSinceLastPosition: 30, positionsToday: 1 });
    expect(result.minEdge).toBe(0.03);
    expect(result.hungry).toBe(false);
  });

  it("holds the strict bar shortly after a position", () => {
    const result = computeUrgency({ ...base, hoursSinceLastPosition: 3, positionsToday: 0 });
    expect(result.minEdge).toBe(0.03);
    expect(result.hungry).toBe(false);
  });

  it("relaxes the bar as the day goes by without a position", () => {
    const early = computeUrgency({ ...base, hoursSinceLastPosition: 10, positionsToday: 0 });
    const later = computeUrgency({ ...base, hoursSinceLastPosition: 16, positionsToday: 0 });
    expect(early.hungry).toBe(true);
    expect(early.minEdge).toBeLessThan(0.03);
    expect(later.minEdge).toBeLessThan(early.minEdge);
  });

  it("ramps smoothly rather than switching — halfway through is halfway relaxed", () => {
    const midpoint = computeUrgency({ ...base, hoursSinceLastPosition: 13, positionsToday: 0 });
    expect(midpoint.hunger).toBeCloseTo(0.5, 2);
    expect(midpoint.minEdge).toBeCloseTo(0.021, 3);
  });

  it("bottoms out at the hungry bar and never goes below it", () => {
    const starving = computeUrgency({ ...base, hoursSinceLastPosition: 20, positionsToday: 0 });
    const beyond = computeUrgency({ ...base, hoursSinceLastPosition: 400, positionsToday: 0 });
    expect(starving.minEdge).toBeCloseTo(0.012, 4);
    expect(beyond.minEdge).toBeCloseTo(0.012, 4);
    expect(beyond.hunger).toBe(1);
  });

  it("never relaxes to zero or negative — a quota must not buy a negative-EV trade", () => {
    const beyond = computeUrgency({ ...base, hoursSinceLastPosition: 10_000, positionsToday: 0 });
    expect(beyond.minEdge).toBeGreaterThan(0);
  });

  it("treats a desk that has never traded as maximally hungry", () => {
    const result = computeUrgency({ ...base, hoursSinceLastPosition: null, positionsToday: 0 });
    expect(result.hungry).toBe(true);
    expect(result.hunger).toBe(1);
    expect(result.minEdge).toBeCloseTo(0.012, 4);
  });

  it("respects a higher daily target", () => {
    const result = computeUrgency({ ...base, dailyTarget: 3, hoursSinceLastPosition: 18, positionsToday: 2 });
    expect(result.hungry).toBe(true);
  });
});

describe("computeAdaptiveShrinkage", () => {
  it("holds the prior until enough predictions have resolved", () => {
    const result = computeAdaptiveShrinkage({ sampleCount: 5, meanAbsCalibrationError: 0.02 });
    expect(result.lambda).toBe(KELLY_SHRINKAGE);
    expect(result.reason).toContain("prior");
  });

  it("trusts a well-calibrated model more", () => {
    const result = computeAdaptiveShrinkage({ sampleCount: 100, meanAbsCalibrationError: 0 });
    expect(result.lambda).toBeCloseTo(0.6, 4);
  });

  it("talks a badly-calibrated model down toward following the market", () => {
    const result = computeAdaptiveShrinkage({ sampleCount: 100, meanAbsCalibrationError: 0.45 });
    expect(result.lambda).toBeCloseTo(0.15, 4);
  });

  it("moves monotonically with measured error", () => {
    const good = computeAdaptiveShrinkage({ sampleCount: 100, meanAbsCalibrationError: 0.05 }).lambda;
    const worse = computeAdaptiveShrinkage({ sampleCount: 100, meanAbsCalibrationError: 0.2 }).lambda;
    expect(good).toBeGreaterThan(worse);
  });
});
