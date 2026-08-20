import "server-only";
import { prisma } from "../prisma";
import { logAdminAction } from "../audit-log";
import { getPolymarketMarketByConditionId, getPolymarketHistoricalPrice } from "./polymarket-client";

export type SettlementResult = { checked: number; settled: number };

/**
 * Checks every open position (simulated or executed, not yet resolved) against Polymarket and
 * scores the ones whose market has closed since it was recorded. A resolved market's winning
 * outcome token converges to a price of 1, the losing one to 0 — so shares bought at entryPrice
 * are worth shares * finalPrice at resolution, same math as a real payout.
 *
 * Positions recorded before entryPrice existed fall back to Polymarket's own price-history API
 * to backfill it (see getPolymarketHistoricalPrice) rather than sitting unscored forever — the
 * backfilled value is persisted back onto the position too, so it also starts showing real odds.
 * If even that comes back empty (very old or short-lived markets sometimes don't retain
 * minute-level history), a loss is still exactly computable without ever knowing entryPrice — a
 * losing share always pays 0 — so only a *win's* exact size stays unknown in that edge case, and
 * gets recorded as a $0 win rather than a guessed number.
 */
export async function settleResolvedPositions(): Promise<SettlementResult> {
  const open = await prisma.capitalCirclePosition.findMany({
    where: { resolvedAt: null, status: { in: ["simulated", "executed"] } },
  });

  let settled = 0;
  for (const position of open) {
    if (!position.tokenId) continue;

    let market;
    try {
      market = await getPolymarketMarketByConditionId(position.marketId);
    } catch (error) {
      console.error(`[capital-circle] settlement lookup failed for ${position.marketId}:`, error);
      continue;
    }
    if (!market || !market.closed) continue;

    const token = market.tokens.find((t) => t.tokenId === position.tokenId);
    if (!token) continue;

    let entryPrice = position.entryPrice != null ? Number(position.entryPrice) : null;
    if (entryPrice == null) {
      entryPrice = await getPolymarketHistoricalPrice(position.tokenId, position.createdAt);
    }

    const sizeUsd = Number(position.sizeUsd);
    let resultUsd: number;
    let note: string;
    if (entryPrice != null && entryPrice > 0) {
      const shares = sizeUsd / entryPrice;
      resultUsd = shares * token.price - sizeUsd;
      note = `entry ${entryPrice}, final ${token.price}`;
    } else if (token.price < 0.5) {
      resultUsd = -sizeUsd;
      note = `lost — full loss is exact even without entryPrice, final ${token.price}`;
    } else {
      resultUsd = 0;
      note = `won, but entryPrice unrecoverable — recorded as $0 rather than a guessed profit, final ${token.price}`;
    }

    await prisma.capitalCirclePosition.update({
      where: { id: position.id },
      data: { resolvedAt: new Date(), resultUsd, entryPrice: entryPrice ?? undefined },
    });
    await logAdminAction({
      action: "capital-circle.position.settle",
      entityType: "capital_circle_position",
      entityId: position.id,
      summary: `Capital Circle settled "${position.question}": ${resultUsd >= 0 ? "+" : ""}$${resultUsd.toFixed(2)} (${note}).`,
      metadata: { conditionId: position.marketId, tokenId: position.tokenId, entryPrice, finalPrice: token.price, sizeUsd, resultUsd },
    });
    settled++;
  }

  return { checked: open.length, settled };
}
