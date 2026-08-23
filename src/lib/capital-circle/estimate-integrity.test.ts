import { describe, expect, it } from "vitest";
import { checkComplementCoherence, describeCoherence } from "./estimate-integrity";
import { buildScoringSlate } from "./scoring-slate";
import type { ScreenedMarket } from "./candidate-filter";

const NOW = new Date("2026-08-23T12:00:00Z");

function twoWay(conditionId: string, a: string, b: string, priceA: number): ScreenedMarket {
  return {
    conditionId,
    question: `${a} vs ${b}`,
    active: true,
    closed: false,
    tokens: [
      { tokenId: `${conditionId}-a`, outcome: a, price: priceA },
      { tokenId: `${conditionId}-b`, outcome: b, price: Number((1 - priceA).toFixed(4)) },
    ],
    endDate: new Date(NOW.getTime() + 6 * 3_600_000),
    volume24hr: 10_000,
    liquidity: 5_000,
    spread: 0.01,
    bestBid: null,
    bestAsk: null,
    slug: null,
    description: null,
    eventId: null,
    category: "esports",
    hoursToResolution: 6,
  };
}

describe("checkComplementCoherence", () => {
  const slate = buildScoringSlate([twoWay("m", "T1", "Hanwha", 0.54)]);
  const questions = new Map([["m", "T1 vs Hanwha"]]);

  it("passes a market whose outcomes sum to 1", () => {
    const report = checkComplementCoherence(
      [
        { tokenId: "m-a", probability: 0.62 },
        { tokenId: "m-b", probability: 0.38 },
      ],
      slate,
      questions,
    );

    expect(report.checked).toBe(1);
    expect(report.incoherent).toHaveLength(0);
    expect(report.quarantinedTokenIds.size).toBe(0);
  });

  it("absorbs the small drift the ensemble median introduces", () => {
    // Independent per-outcome medians are not guaranteed to sum to exactly 1, so a
    // couple of points of slack has to be tolerated or every cycle would quarantine itself.
    const report = checkComplementCoherence(
      [
        { tokenId: "m-a", probability: 0.6 },
        { tokenId: "m-b", probability: 0.44 },
      ],
      slate,
      questions,
    );
    expect(report.incoherent).toHaveLength(0);
  });

  it("quarantines both sides when the model contradicts itself about a market", () => {
    // 0.8 on both sides is not a forecast of anything, and whichever side is cheaper
    // would show a large fabricated edge to the selection stage.
    const report = checkComplementCoherence(
      [
        { tokenId: "m-a", probability: 0.8 },
        { tokenId: "m-b", probability: 0.8 },
      ],
      slate,
      questions,
    );

    expect(report.incoherent).toHaveLength(1);
    expect(report.incoherent[0]).toMatchObject({ sum: 1.6, question: "T1 vs Hanwha" });
    expect(report.quarantinedTokenIds).toEqual(new Set(["m-a", "m-b"]));
    expect(describeCoherence(report)).toContain("quarantined");
  });

  it("skips a market the model only half priced, and counts it", () => {
    // A missing side says nothing about coherence — the absent number could have been anything.
    const report = checkComplementCoherence([{ tokenId: "m-a", probability: 0.62 }], slate, questions);

    expect(report.checked).toBe(0);
    expect(report.incomplete).toBe(1);
    expect(report.quarantinedTokenIds.size).toBe(0);
  });

  it("judges each market independently", () => {
    const wide = buildScoringSlate([twoWay("good", "A", "B", 0.5), twoWay("bad", "C", "D", 0.5)]);
    const report = checkComplementCoherence(
      [
        { tokenId: "good-a", probability: 0.7 },
        { tokenId: "good-b", probability: 0.3 },
        { tokenId: "bad-a", probability: 0.9 },
        { tokenId: "bad-b", probability: 0.9 },
      ],
      wide,
    );

    expect(report.checked).toBe(2);
    expect(report.incoherent).toHaveLength(1);
    expect(report.quarantinedTokenIds).toEqual(new Set(["bad-a", "bad-b"]));
  });

  it("says nothing when there is nothing to say", () => {
    expect(describeCoherence({ checked: 3, incomplete: 0, incoherent: [], quarantinedTokenIds: new Set() })).toBeNull();
  });
});
