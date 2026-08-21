import { describe, expect, it } from "vitest";
import { parseMarket, toNum } from "./polymarket-client";

/**
 * Shaped after a real Gamma /markets response: outcomes, outcomePrices and
 * clobTokenIds arrive as JSON-encoded strings holding parallel arrays, and the
 * numeric fields are inconsistently typed between markets.
 *
 * `tags` here is a fixture convenience, not reality — confirmed live that a real /markets row
 * carries no `tags` field at all (see parseCategory's comment). Every "classifies from tags" test
 * below exercises a path production never takes; "falls back to the slug" and the EPL test near
 * the bottom of this file are the ones that match what actually happens on a live cycle.
 */
const GAMMA_FIXTURE = {
  conditionId: "0xabc123",
  question: "Will BTC be above $100k on August 21?",
  slug: "btc-100k-aug-21",
  description: "This market resolves YES if the Binance BTCUSDT price at 12:00 ET exceeds 100000.",
  active: true,
  closed: false,
  endDate: "2026-08-21T16:00:00Z",
  outcomes: '["Yes", "No"]',
  outcomePrices: '["0.62", "0.38"]',
  clobTokenIds: '["111", "222"]',
  volume24hr: 45123.5,
  liquidity: "8200.25",
  spread: "0.02",
  bestBid: 0.61,
  bestAsk: 0.63,
  events: [{ id: "evt-9", title: "BTC price markets" }],
  tags: [{ label: "Crypto" }, { label: "Bitcoin" }],
};

describe("toNum", () => {
  it("accepts both the string and number forms Gamma mixes", () => {
    expect(toNum("8200.25")).toBe(8200.25);
    expect(toNum(45123.5)).toBe(45123.5);
  });

  it("treats missing or unparseable values as absent rather than zero", () => {
    // Reading a bad value as 0 would silently fail the liquidity filter for every market.
    expect(toNum(null)).toBeNull();
    expect(toNum(undefined)).toBeNull();
    expect(toNum("")).toBeNull();
    expect(toNum("not-a-number")).toBeNull();
    expect(toNum(Number.NaN)).toBeNull();
  });
});

describe("parseMarket", () => {
  it("parses the parallel JSON-encoded arrays into outcome tokens", () => {
    const market = parseMarket(GAMMA_FIXTURE);
    expect(market?.tokens).toEqual([
      { tokenId: "111", outcome: "Yes", price: 0.62 },
      { tokenId: "222", outcome: "No", price: 0.38 },
    ]);
  });

  it("keeps the tradability fields the agent needs to judge whether a market is enterable", () => {
    const market = parseMarket(GAMMA_FIXTURE);
    expect(market).toMatchObject({
      volume24hr: 45123.5,
      liquidity: 8200.25,
      spread: 0.02,
      bestBid: 0.61,
      bestAsk: 0.63,
      slug: "btc-100k-aug-21",
      eventId: "evt-9",
      category: "crypto",
    });
  });

  it("truncates the description so resolution criteria don't crowd out the market list", () => {
    const market = parseMarket({ ...GAMMA_FIXTURE, description: "x".repeat(2000) });
    expect(market?.description).toHaveLength(500);
  });

  it("classifies topics from tags", () => {
    const tagged = (label: string) => parseMarket({ ...GAMMA_FIXTURE, slug: "", tags: [{ label }] })?.category;
    expect(tagged("NBA")).toBe("sports");
    expect(tagged("US Election")).toBe("politics");
    expect(tagged("Inflation")).toBe("economics");
    expect(tagged("Weather")).toBe("other");
    expect(parseMarket({ ...GAMMA_FIXTURE, tags: [], slug: "" })?.category).toBeNull();
  });

  it("matches whole words, not substrings", () => {
    // "i-nfl-ation" and "s-eth-eby" both match a naive substring classifier, which would file
    // macro and unrelated markets under the wrong topic and corrupt the per-category record.
    const tagged = (label: string) => parseMarket({ ...GAMMA_FIXTURE, slug: "", tags: [{ label }] })?.category;
    expect(tagged("Inflation")).toBe("economics");
    expect(tagged("Sotheby's auction")).toBe("other");
  });

  it("falls back to the slug when a market carries no usable tags", () => {
    expect(parseMarket({ ...GAMMA_FIXTURE, tags: [], slug: "nfl-week-3" })?.category).toBe("sports");
  });

  it("classifies real live slug shapes — this is the path production actually runs, tags never included", () => {
    const slugOnly = (slug: string) => parseMarket({ ...GAMMA_FIXTURE, tags: undefined, slug })?.category;
    // Verified live against gamma-api.polymarket.com/markets on 2026-08-21 — these are real slugs
    // of markets that were active at the time, none of which the pre-fix keyword list matched.
    expect(slugOnly("epl-ars-cov-2026-08-21-ars")).toBe("sports");
    expect(slugOnly("epl-new-liv-2026-08-23-draw")).toBe("sports");
    expect(slugOnly("mlb-atl-mil-2026-08-21-total-6pt5")).toBe("sports");
    expect(slugOnly("uefa-champions-league-winner-2027")).toBe("sports");
    expect(slugOnly("la-liga-top-scorer-2026-27")).toBe("sports");
    expect(slugOnly("us-x-iran-ceasefire-continues-through-august-22")).toBe("politics");
  });

  it("classifies esports as its own category, not sports or other", () => {
    // A live top-300-by-volume snapshot on 2026-08-21 found esports (dota2/lol/cs2/valorant) as
    // the single largest unclassified vertical — a Dota2 match at $3.8M in 24h volume outranked
    // every crypto and traditional-sports market in the entire snapshot. These are real slugs
    // from that snapshot, checked for zero false positives against the whole set first.
    const slugOnly = (slug: string) => parseMarket({ ...GAMMA_FIXTURE, tags: undefined, slug })?.category;
    expect(slugOnly("dota2-ts8-vsn2-2026-08-21-game1")).toBe("esports");
    expect(slugOnly("lol-bro2-fox1-2026-08-21")).toBe("esports");
    expect(slugOnly("cs2-fut-mouz-2026-08-21")).toBe("esports");
    expect(slugOnly("val-drx1-spe-2026-08-21")).toBe("esports");
  });

  it("reports a real, non-empty slug that matches nothing as 'other', not null", () => {
    // The old `labels.length > 0 ? "other" : null` gate never fired in production (tags are
    // never populated on a live /markets response), so every unmatched market — 71% of the top
    // 300 by volume in the same snapshot — silently became "uncategorized" with no visibility.
    // A market always has a slug; "other" should mean "we looked and it's genuinely unclassified",
    // not "we never had the tags to look in the first place".
    expect(parseMarket({ ...GAMMA_FIXTURE, tags: undefined, slug: "highest-temperature-in-seoul-on-august-21-2026-27c" })?.category).toBe(
      "other",
    );
    // An empty slug is the one genuinely informationless case — still null.
    expect(parseMarket({ ...GAMMA_FIXTURE, tags: undefined, slug: "" })?.category).toBeNull();
  });

  it("accepts plain-string tags as well as objects", () => {
    expect(parseMarket({ ...GAMMA_FIXTURE, slug: "", tags: ["Crypto"] })?.category).toBe("crypto");
  });

  it("falls back through the volume field aliases", () => {
    const market = parseMarket({ ...GAMMA_FIXTURE, volume24hr: undefined, volumeNum: 900 });
    expect(market?.volume24hr).toBe(900);
  });

  it("reports missing tradability fields as null rather than inventing zeroes", () => {
    const market = parseMarket({
      ...GAMMA_FIXTURE,
      volume24hr: undefined,
      volumeNum: undefined,
      volume: undefined,
      liquidity: undefined,
      spread: undefined,
      bestBid: undefined,
      bestAsk: undefined,
      events: [],
    });
    expect(market).toMatchObject({ volume24hr: null, liquidity: null, spread: null, bestBid: null, bestAsk: null, eventId: null });
  });

  it("rejects markets missing the fields a trade would need", () => {
    expect(parseMarket(null)).toBeNull();
    expect(parseMarket({ ...GAMMA_FIXTURE, conditionId: undefined })).toBeNull();
    expect(parseMarket({ ...GAMMA_FIXTURE, question: undefined })).toBeNull();
    expect(parseMarket({ ...GAMMA_FIXTURE, endDate: "not-a-date" })).toBeNull();
    expect(parseMarket({ ...GAMMA_FIXTURE, endDate: undefined })).toBeNull();
  });

  it("survives malformed outcome arrays instead of throwing mid-cycle", () => {
    expect(parseMarket({ ...GAMMA_FIXTURE, outcomePrices: "{not json" })?.tokens).toEqual([]);
    expect(parseMarket({ ...GAMMA_FIXTURE, clobTokenIds: '"a string"' })?.tokens).toEqual([]);
  });

  it("drops tokens whose price is unparseable but keeps the rest", () => {
    const market = parseMarket({ ...GAMMA_FIXTURE, outcomePrices: '["0.62", "bad"]' });
    expect(market?.tokens).toHaveLength(1);
    expect(market?.tokens[0].tokenId).toBe("111");
  });

  it("reads the closed and active flags the settlement path depends on", () => {
    expect(parseMarket({ ...GAMMA_FIXTURE, closed: true })?.closed).toBe(true);
    expect(parseMarket({ ...GAMMA_FIXTURE, active: false })?.active).toBe(false);
    // Absent `active` means active — Gamma omits it on plenty of live markets.
    expect(parseMarket({ ...GAMMA_FIXTURE, active: undefined })?.active).toBe(true);
  });
});
