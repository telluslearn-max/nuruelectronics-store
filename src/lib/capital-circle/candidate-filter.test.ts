import { describe, expect, it } from "vitest";
import { filterAndRankCandidates } from "./candidate-filter";
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
    // Pure volume ranking would have returned zero of these — the hourly markets outrank them by
    // three orders of magnitude. Asserted as "every one that existed got in" rather than a fixed
    // count, so re-weighting the buckets doesn't read as a broken test.
    const longer = result.candidates.filter((c) => c.hoursToResolution > 6);
    expect(longer).toHaveLength(later.length);
  });

  it("no longer hands most of the slate to markets resolving within hours", () => {
    // The near bucket used to reserve 30% of the slate for markets the scoring prompt itself
    // calls close to unpredictable, so those slots could never produce a trade. Against a live
    // 72h window that was 16 of 48 slots. Pinned as a ceiling: the exact share can be retuned,
    // but the near bucket must never again be the largest claim on the slate.
    //
    // All three horizons are populated on purpose. With the far bucket empty the top-up below
    // the buckets refills the slate from raw volume — which is the intended behaviour (an empty
    // bucket should cost diversity, not slate size) but it hands those spare slots straight back
    // to the hourly markets, so a fixture missing a horizon tests the fallback, not the split.
    const hourly = Array.from({ length: 40 }, (_, i) =>
      market({ conditionId: `hourly-${i}`, volume24hr: 1_000_000 - i, endDate: new Date(NOW.getTime() + 1 * 3_600_000) }),
    );
    const mid = Array.from({ length: 40 }, (_, i) =>
      market({ conditionId: `mid-${i}`, volume24hr: 5_000 - i, endDate: new Date(NOW.getTime() + 12 * 3_600_000) }),
    );
    const far = Array.from({ length: 40 }, (_, i) =>
      market({ conditionId: `far-${i}`, volume24hr: 4_000 - i, endDate: new Date(NOW.getTime() + 48 * 3_600_000) }),
    );

    const candidates = filterAndRankCandidates([...hourly, ...mid, ...far], { now: NOW, limit: 40 }).candidates;
    const nearCount = candidates.filter((c) => c.hoursToResolution <= 6).length;
    expect(nearCount).toBeLessThanOrEqual(Math.floor(40 * 0.15));
    expect(candidates.length - nearCount).toBeGreaterThan(nearCount * 3);
  });

  it("never returns more than the limit", () => {
    const many = Array.from({ length: 40 }, (_, i) => market({ conditionId: `m-${i}`, volume24hr: 10_000 + i }));
    expect(filterAndRankCandidates(many, { now: NOW, limit: 12 }).candidates).toHaveLength(12);
  });
});

// The model-facing projection of a screened market moved to scoring-slate.ts, and
// is covered by scoring-slate.test.ts — including the fields asserted here before.
