import { describe, expect, it } from "vitest";
import {
  buildScoringSlate,
  describeResolutionIssues,
  mergeResolutions,
  normalizeOutcomeLabel,
  resolveScoringEstimates,
} from "./scoring-slate";
import type { ScreenedMarket } from "./candidate-filter";

const NOW = new Date("2026-08-23T12:00:00Z");

function market(overrides: Partial<ScreenedMarket> & { conditionId: string }): ScreenedMarket {
  return {
    question: `Question ${overrides.conditionId}`,
    active: true,
    closed: false,
    tokens: [
      { tokenId: `${overrides.conditionId}-yes`, outcome: "Yes", price: 0.55 },
      { tokenId: `${overrides.conditionId}-no`, outcome: "No", price: 0.45 },
    ],
    endDate: new Date(NOW.getTime() + 6 * 3_600_000),
    volume24hr: 10_000,
    liquidity: 5_000,
    spread: 0.01,
    bestBid: 0.54,
    bestAsk: 0.56,
    slug: null,
    description: null,
    eventId: null,
    category: "crypto",
    hoursToResolution: 6,
    ...overrides,
  };
}

/** A real matchup shape: two team names rather than Yes/No, which is where mis-pairing bites. */
function matchup(conditionId: string, home: string, away: string, homePrice: number): ScreenedMarket {
  return market({
    conditionId,
    question: `${home} vs ${away}`,
    category: "esports",
    tokens: [
      { tokenId: `${conditionId}-home`, outcome: home, price: homePrice },
      { tokenId: `${conditionId}-away`, outcome: away, price: Number((1 - homePrice).toFixed(4)) },
    ],
  });
}

describe("buildScoringSlate", () => {
  it("addresses outcomes by short refs instead of raw token ids", () => {
    const slate = buildScoringSlate([market({ conditionId: "a" }), market({ conditionId: "b" })]);

    expect(slate.views.map((view) => view.ref)).toEqual(["m1", "m2"]);
    expect(slate.views[0].outcomes.map((outcome) => outcome.ref)).toEqual(["m1a", "m1b"]);
    expect(slate.outcomeCount).toBe(4);
    // The real identifiers stay in code, never in the payload the model has to echo.
    expect(JSON.stringify(slate.views)).not.toContain("a-yes");
    expect(slate.byRef.get("m1a")?.tokenId).toBe("a-yes");
  });

  it("carries the fields that should bear on a probability estimate, and nothing else", () => {
    const slate = buildScoringSlate([
      market({ conditionId: "a", description: "Resolves YES if...", liquidity: 5_000, volume24hr: 10_000 }),
    ]);

    expect(slate.views[0]).toMatchObject({
      question: "Question a",
      category: "crypto",
      liquidityUsd: 5_000,
      volume24hUsd: 10_000,
      resolutionCriteria: "Resolves YES if...",
    });
    expect(slate.views[0].outcomes[0]).toMatchObject({ outcome: "Yes", marketPrice: 0.55 });
  });

  it("gives markets of one event a shared short event ref so correlated legs are visible", () => {
    const slate = buildScoringSlate([
      market({ conditionId: "a", eventId: "evt-123" }),
      market({ conditionId: "b", eventId: "evt-123" }),
      market({ conditionId: "c", eventId: "evt-999" }),
      market({ conditionId: "d", eventId: null }),
    ]);

    expect(slate.views[0].eventRef).toBe("e1");
    expect(slate.views[1].eventRef).toBe("e1");
    expect(slate.views[2].eventRef).toBe("e2");
    expect(slate.views[3].eventRef).toBeNull();
  });

  it("omits the market price entirely when the slate is built blind", () => {
    const slate = buildScoringSlate([market({ conditionId: "a" })], { showMarketPrice: false });
    expect(slate.views[0].outcomes[0]).toEqual({ ref: "m1a", outcome: "Yes" });
    // Still known to code, so the edge gate and the blend are unaffected.
    expect(slate.byRef.get("m1a")?.marketPrice).toBe(0.55);
  });

  it("keeps refs distinct past the 26th outcome", () => {
    const many = market({
      conditionId: "wide",
      tokens: Array.from({ length: 28 }, (_, i) => ({ tokenId: `t${i}`, outcome: `O${i}`, price: 0.5 })),
    });
    const slate = buildScoringSlate([many]);
    const refs = slate.views[0].outcomes.map((outcome) => outcome.ref);
    expect(new Set(refs).size).toBe(28);
    expect(refs[25]).toBe("m1z");
    expect(refs[26]).toBe("m1aa");
  });
});

describe("resolveScoringEstimates", () => {
  const slate = buildScoringSlate([matchup("lck", "T1", "Hanwha Life Esports", 0.54)]);

  it("resolves a correctly paired estimate back to the real market and token", () => {
    const result = resolveScoringEstimates(
      [{ ref: "m1a", outcome: "T1", probability: 0.62, rationale: "roster form" }],
      slate,
    );

    expect(result.estimates).toEqual([
      { marketId: "lck", tokenId: "lck-home", probability: 0.62, rationale: "roster form" },
    ]);
    expect(result.issues.swapped_outcome).toBe(0);
  });

  it("rejects the estimate that would have cost the most: a name from the market's other side", () => {
    // This is the production failure in miniature. The model prices T1 at 0.84 but pairs it with
    // the ref addressing the opponent, whose price is 0.46 — which downstream reads as a 38-point
    // edge on the underdog. Dropping it is the whole point; it must never reach the edge gate.
    const result = resolveScoringEstimates([{ ref: "m1b", outcome: "T1", probability: 0.84 }], slate);

    expect(result.estimates).toHaveLength(0);
    expect(result.issues.swapped_outcome).toBe(1);
    expect(result.swaps[0]).toMatchObject({
      ref: "m1b",
      claimed: "T1",
      expected: "Hanwha Life Esports",
      matchedRef: "m1a",
    });
  });

  it("tolerates case and punctuation drift in the echoed name", () => {
    const result = resolveScoringEstimates([{ ref: "m1b", outcome: "hanwha life  esports ", probability: 0.46 }], slate);
    expect(result.estimates).toHaveLength(1);
    expect(result.issues.swapped_outcome).toBe(0);
  });

  it("does not cry swap when a market's outcomes happen to share a name", () => {
    // A find() over the siblings before checking the ref's own name would return the earlier
    // twin here and report a swap that never happened, quarantining a perfectly good estimate.
    const twins = buildScoringSlate([
      {
        ...matchup("dup", "Yes", "Yes", 0.5),
      },
    ]);
    const result = resolveScoringEstimates([{ ref: "m1b", outcome: "Yes", probability: 0.5 }], twins);

    expect(result.issues.swapped_outcome).toBe(0);
    expect(result.estimates[0].tokenId).toBe("dup-away");
  });

  it("fails closed when the outcome label is missing, since nothing can be verified without it", () => {
    const result = resolveScoringEstimates([{ ref: "m1a", probability: 0.62 }], slate);
    expect(result.estimates).toHaveLength(0);
    expect(result.issues.missing_outcome_label).toBe(1);
  });

  it("drops unknown refs, unrecognized names, bad probabilities and repeats, counting each", () => {
    const result = resolveScoringEstimates(
      [
        { ref: "m9z", outcome: "T1", probability: 0.5 },
        { ref: "m1a", outcome: "Cloud9", probability: 0.5 },
        { ref: "m1a", outcome: "T1", probability: 1.4 },
        { ref: "m1b", outcome: "Hanwha Life Esports", probability: 0.46 },
        { ref: "m1b", outcome: "Hanwha Life Esports", probability: 0.5 },
      ],
      slate,
    );

    expect(result.issues).toMatchObject({
      unknown_ref: 1,
      unrecognized_outcome: 1,
      invalid_probability: 1,
      duplicate_ref: 1,
    });
    expect(result.estimates).toHaveLength(1);
    expect(result.estimates[0].probability).toBe(0.46);
  });

  it("reports coverage against the slate so a quietly halved response is visible", () => {
    const wide = buildScoringSlate([matchup("a", "X", "Y", 0.5), matchup("b", "P", "Q", 0.5)]);
    const result = resolveScoringEstimates(
      [
        { ref: "m1a", outcome: "X", probability: 0.5 },
        { ref: "m1b", outcome: "Y", probability: 0.5 },
      ],
      wide,
    );
    expect(result.coverage).toBe(0.5);
  });
});

describe("mergeResolutions and describeResolutionIssues", () => {
  const slate = buildScoringSlate([matchup("lck", "T1", "Hanwha Life Esports", 0.54)]);

  it("stays silent when every sample resolved cleanly", () => {
    const clean = resolveScoringEstimates(
      [
        { ref: "m1a", outcome: "T1", probability: 0.6 },
        { ref: "m1b", outcome: "Hanwha Life Esports", probability: 0.4 },
      ],
      slate,
    );
    expect(describeResolutionIssues(mergeResolutions([clean, clean]))).toBeNull();
  });

  it("sums issues across ensemble samples and leads with the swap", () => {
    const dirty = resolveScoringEstimates(
      [
        { ref: "m1b", outcome: "T1", probability: 0.84 },
        { ref: "m9z", outcome: "T1", probability: 0.5 },
      ],
      slate,
    );
    const merged = mergeResolutions([dirty, dirty, dirty]);

    expect(merged.issues.swapped_outcome).toBe(3);
    expect(merged.issues.unknown_ref).toBe(3);

    const description = describeResolutionIssues(merged);
    expect(description).toContain("3 estimate(s) named an outcome that belongs to a DIFFERENT side");
    expect(description).toContain("not traded");
  });
});

describe("normalizeOutcomeLabel", () => {
  it("collapses formatting without collapsing genuinely different outcomes", () => {
    expect(normalizeOutcomeLabel("  T1 ")).toBe(normalizeOutcomeLabel("t1"));
    expect(normalizeOutcomeLabel("Over 4.5")).not.toBe(normalizeOutcomeLabel("Under 4.5"));
    expect(normalizeOutcomeLabel("Arsenal")).not.toBe(normalizeOutcomeLabel("Chelsea"));
  });
});
