/**
 * Screens live markets down to a tradeable candidate set before the model
 * sees them.
 *
 * The point is that untradeable markets should be impossible to pick, not
 * merely discouraged in a prompt. Previously the agent was handed whatever
 * twenty markets Gamma returned first, with no liquidity, volume or spread
 * information attached — so "don't trade illiquid markets" was an instruction
 * it had no data to follow even if it wanted to.
 *
 * Pure module (no server-only, no I/O) — see candidate-filter.test.ts.
 */

import {
  CANDIDATE_LIMIT,
  MAX_ENTRY_PRICE,
  MAX_SPREAD,
  MIN_ENTRY_PRICE,
  MIN_LIQUIDITY_USD,
  MIN_VOLUME_24H_USD,
} from "./config";
import type { PolymarketMarketSummary } from "./polymarket-client";

export type ScreenedMarket = PolymarketMarketSummary & { hoursToResolution: number };

export type ScreeningResult = {
  candidates: ScreenedMarket[];
  /** Why each dropped market was dropped — surfaced in the cycle log so "no trade" is auditable. */
  dropped: { question: string; reason: string }[];
};

export type ScreeningOptions = {
  now?: Date;
  limit?: number;
  minLiquidityUsd?: number;
  minVolume24hUsd?: number;
  maxSpread?: number;
};

/**
 * Horizon buckets, each guaranteed a share of the slate.
 *
 * A pure volume ranking over the search window is dominated by the hourly
 * crypto up/down markets — enormous volume, and close to coin flips where a
 * language model has the least to add. Reserving space for markets resolving
 * further out keeps genuinely researchable questions on the list, which is
 * where any real edge is going to come from.
 */
const HORIZON_BUCKETS: { label: string; maxHours: number; share: number }[] = [
  { label: "near", maxHours: 6, share: 0.3 },
  { label: "mid", maxHours: 24, share: 0.35 },
  { label: "far", maxHours: Number.POSITIVE_INFINITY, share: 0.35 },
];

export function filterAndRankCandidates(
  markets: PolymarketMarketSummary[],
  options: ScreeningOptions = {},
): ScreeningResult {
  const now = options.now ?? new Date();
  const limit = options.limit ?? CANDIDATE_LIMIT;
  const minLiquidity = options.minLiquidityUsd ?? MIN_LIQUIDITY_USD;
  const minVolume = options.minVolume24hUsd ?? MIN_VOLUME_24H_USD;
  const maxSpread = options.maxSpread ?? MAX_SPREAD;

  const dropped: ScreeningResult["dropped"] = [];
  const kept: ScreenedMarket[] = [];

  for (const market of markets) {
    const drop = (reason: string) => dropped.push({ question: market.question, reason });

    if (market.closed || !market.active) {
      drop("Not active.");
      continue;
    }
    if (market.tokens.length === 0) {
      drop("No outcome tokens returned.");
      continue;
    }

    const hoursToResolution = (market.endDate.getTime() - now.getTime()) / 3_600_000;
    if (hoursToResolution <= 0) {
      drop("Already past its resolution time.");
      continue;
    }

    // Missing liquidity data fails the check rather than passing it: an unknown book is
    // exactly the case where a $25 order might be the only order.
    if (market.liquidity == null || market.liquidity < minLiquidity) {
      drop(`Liquidity ${market.liquidity ?? "unknown"} is under the $${minLiquidity} floor.`);
      continue;
    }
    if (market.volume24hr == null || market.volume24hr < minVolume) {
      drop(`24h volume ${market.volume24hr ?? "unknown"} is under the $${minVolume} floor — the price is stale and there's no exit.`);
      continue;
    }
    if (market.spread != null && market.spread > maxSpread) {
      drop(`Spread ${market.spread} exceeds ${maxSpread} — the round trip costs more than any edge we could have.`);
      continue;
    }

    // A market where every outcome sits outside the tradeable band has nothing to buy:
    // the favourite pays a few cents against a full-size loss, and the longshot is a
    // lottery ticket we cannot price to that precision.
    const hasTradeableSide = market.tokens.some((token) => token.price >= MIN_ENTRY_PRICE && token.price <= MAX_ENTRY_PRICE);
    if (!hasTradeableSide) {
      drop(`Every outcome is priced outside ${MIN_ENTRY_PRICE}–${MAX_ENTRY_PRICE} — no side worth buying.`);
      continue;
    }

    kept.push({ ...market, hoursToResolution });
  }

  const byVolume = [...kept].sort((a, b) => (b.volume24hr ?? 0) - (a.volume24hr ?? 0));

  // Fill each horizon bucket from its own volume ranking, then top the slate back up to
  // `limit` from whatever's left — so an empty bucket costs diversity, never slate size.
  const chosen: ScreenedMarket[] = [];
  const takenIds = new Set<string>();
  let lowerBound = 0;
  for (const bucket of HORIZON_BUCKETS) {
    const slots = Math.floor(limit * bucket.share);
    const inBucket = byVolume.filter(
      (market) => market.hoursToResolution > lowerBound && market.hoursToResolution <= bucket.maxHours,
    );
    for (const market of inBucket.slice(0, slots)) {
      chosen.push(market);
      takenIds.add(market.conditionId);
    }
    lowerBound = bucket.maxHours;
  }

  for (const market of byVolume) {
    if (chosen.length >= limit) break;
    if (takenIds.has(market.conditionId)) continue;
    chosen.push(market);
    takenIds.add(market.conditionId);
  }

  const candidates = chosen.sort((a, b) => (b.volume24hr ?? 0) - (a.volume24hr ?? 0)).slice(0, limit);

  return { candidates, dropped };
}

/**
 * The compact shape handed to the model for scoring — every field is something
 * that should bear on a probability estimate, and nothing else, since context
 * spent on boilerplate is context not spent on the question.
 */
export function toScoringView(market: ScreenedMarket) {
  return {
    marketId: market.conditionId,
    question: market.question,
    category: market.category,
    hoursToResolution: Number(market.hoursToResolution.toFixed(2)),
    resolutionCriteria: market.description,
    liquidityUsd: market.liquidity,
    volume24hUsd: market.volume24hr,
    spread: market.spread,
    outcomes: market.tokens.map((token) => ({
      tokenId: token.tokenId,
      outcome: token.outcome,
      marketPrice: token.price,
    })),
  };
}
