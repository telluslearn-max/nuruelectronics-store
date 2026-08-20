import { describe, expect, it } from "vitest";
import { filterAndRankCandidates, toScoringView } from "./candidate-filter";
import type { PolymarketMarketSummary } from "./polymarket-client";

const NOW = new Date("2026-08-20T12:00:00Z");

function market(overrides: Partial<PolymarketMarketSummary> & { conditionId: string }): PolymarketMarketSummary {
  return {
    question: `Question ${overrides.conditionId}`,
    active: true,
    closed: false,
    tokens: [
      { tokenId: `${overrides.conditionId}-yes`, outcome: "Yes", price: 0.55 },
      { tokenId: `${overrides.conditionId}-no`, outcome: "No", price: 0.45 },
    ],
    endDate: new Date(NOW.getTime() + 2 * 3_600_000),
    volume24hr: 10_000,
    liquidity: 5_000,
    spread: 0.01,
    bestBid: 0.54,
    bestAsk: 0.56,
    slug: null,
    description: null,
    eventId: null,
    category: "crypto",
    ...overrides,
  };
}

describe("filterAndRankCandidates", () => {
  it("keeps a healthy market", () => {
    const result = filterAndRankCandidates([market({ conditionId: "a" })], { now: NOW });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].hoursToResolution).toBeCloseTo(2, 5);
  });

  it("drops thin books — including when liquidity is simply unknown", () => {
    const result = filterAndRankCandidates(
      [market({ conditionId: "a", liquidity: 50 }), market({ conditionId: "b", liquidity: null })],
      { now: NOW },
    );
    expect(result.candidates).toHaveLength(0);
    expect(result.dropped).toHaveLength(2);
    expect(result.dropped[0].reason).toContain("Liquidity");
  });

  it("drops markets nobody traded today", () => {
    const result = filterAndRankCandidates([market({ conditionId: "a", volume24hr: 10 })], { now: NOW });
    expect(result.candidates).toHaveLength(0);
    expect(result.dropped[0].reason).toContain("volume");
  });

  it("drops markets whose spread exceeds any plausible edge", () => {
    const result = filterAndRankCandidates([market({ conditionId: "a", spread: 0.2 })], { now: NOW });
    expect(result.candidates).toHaveLength(0);
    expect(result.dropped[0].reason).toContain("Spread");
  });

  it("drops resolved-in-all-but-name markets with no tradeable side", () => {
    const result = filterAndRankCandidates(
      [
        market({
          conditionId: "a",
          tokens: [
            { tokenId: "a-yes", outcome: "Yes", price: 0.995 },
            { tokenId: "a-no", outcome: "No", price: 0.005 },
          ],
        }),
      ],
      { now: NOW },
    );
    expect(result.candidates).toHaveLength(0);
    expect(result.dropped[0].reason).toContain("outside");
  });

  it("keeps a lopsided market when the cheap side is still priceable", () => {
    const result = filterAndRankCandidates(
      [
        market({
          conditionId: "a",
          tokens: [
            { tokenId: "a-yes", outcome: "Yes", price: 0.9 },
            { tokenId: "a-no", outcome: "No", price: 0.1 },
          ],
        }),
      ],
      { now: NOW },
    );
    expect(result.candidates).toHaveLength(1);
  });

  it("drops markets that already passed their resolution time, and inactive ones", () => {
    const result = filterAndRankCandidates(
      [
        market({ conditionId: "a", endDate: new Date(NOW.getTime() - 3_600_000) }),
        market({ conditionId: "b", closed: true }),
        market({ conditionId: "c", active: false }),
        market({ conditionId: "d", tokens: [] }),
      ],
      { now: NOW },
    );
    expect(result.candidates).toHaveLength(0);
    expect(result.dropped).toHaveLength(4);
  });

  it("ranks by 24h volume", () => {
    const result = filterAndRankCandidates(
      [
        market({ conditionId: "low", volume24hr: 1_000 }),
        market({ conditionId: "high", volume24hr: 90_000 }),
        market({ conditionId: "mid", volume24hr: 20_000 }),
      ],
      { now: NOW },
    );
    expect(result.candidates.map((c) => c.conditionId)).toEqual(["high", "mid", "low"]);
  });

  it("reserves slate space for longer-horizon markets so the list isn't all hourly coin flips", () => {
    const hourly = Array.from({ length: 20 }, (_, i) =>
      market({ conditionId: `hourly-${i}`, volume24hr: 1_000_000 - i, endDate: new Date(NOW.getTime() + 1 * 3_600_000) }),
    );
    const later = Array.from({ length: 5 }, (_, i) =>
      market({ conditionId: `later-${i}`, volume24hr: 5_000 - i, endDate: new Date(NOW.getTime() + 12 * 3_600_000) }),
    );

    const result = filterAndRankCandidates([...hourly, ...later], { now: NOW, limit: 12 });
    expect(result.candidates).toHaveLength(12);
    const longerCount = result.candidates.filter((c) => c.hoursToResolution > 6).length;
    // Without the horizon reservation, pure volume ranking would have returned zero of these.
    expect(longerCount).toBe(4);
  });

  it("never returns more than the limit", () => {
    const many = Array.from({ length: 40 }, (_, i) => market({ conditionId: `m-${i}`, volume24hr: 10_000 + i }));
    expect(filterAndRankCandidates(many, { now: NOW, limit: 12 }).candidates).toHaveLength(12);
  });
});

describe("toScoringView", () => {
  it("exposes exactly the fields that should bear on a probability estimate", () => {
    const [candidate] = filterAndRankCandidates([market({ conditionId: "a", description: "Resolves YES if..." })], { now: NOW }).candidates;
    const view = toScoringView(candidate);
    expect(view).toMatchObject({
      marketId: "a",
      category: "crypto",
      liquidityUsd: 5_000,
      volume24hUsd: 10_000,
      resolutionCriteria: "Resolves YES if...",
    });
    expect(view.outcomes).toHaveLength(2);
    expect(view.outcomes[0]).toMatchObject({ outcome: "Yes", marketPrice: 0.55 });
  });
});
