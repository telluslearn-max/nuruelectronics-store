import "server-only";
import { prisma } from "../prisma";
import { logAdminAction } from "../audit-log";
import { getPolymarketMarketByConditionId } from "./polymarket-client";

export type SettlementResult = { checked: number; settled: number };

/**
 * Checks every open position (simulated or executed, not yet resolved) against Polymarket and
 * scores the ones whose market has closed since it was recorded. A resolved market's winning
 * outcome token converges to a price of 1, the losing one to 0 — so shares bought at entryPrice
 * are worth shares * finalPrice at resolution, same math as a real payout.
 *
 * Positions recorded before entryPrice existed, or where the market's tokens no longer include
 * the one traded (a Gamma API quirk seen on some resolved markets), are left open rather than
 * guessed at — they'll just never get a resultUsd, which is visible on the report as "unresolved"
 * rather than silently wrong.
 */
export async function settleResolvedPositions(): Promise<SettlementResult> {
  const open = await prisma.capitalCirclePosition.findMany({
    where: { resolvedAt: null, status: { in: ["simulated", "executed"] } },
  });

  let settled = 0;
  for (const position of open) {
    if (!position.tokenId || position.entryPrice == null) continue;

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

    const entryPrice = Number(position.entryPrice);
    if (!(entryPrice > 0)) continue;

    const sizeUsd = Number(position.sizeUsd);
    const shares = sizeUsd / entryPrice;
    const resultUsd = shares * token.price - sizeUsd;

    await prisma.capitalCirclePosition.update({
      where: { id: position.id },
      data: { resolvedAt: new Date(), resultUsd },
    });
    await logAdminAction({
      action: "capital-circle.position.settle",
      entityType: "capital_circle_position",
      entityId: position.id,
      summary: `Capital Circle settled "${position.question}": ${resultUsd >= 0 ? "+" : ""}$${resultUsd.toFixed(2)} (entry ${entryPrice}, final ${token.price}).`,
      metadata: { conditionId: position.marketId, tokenId: position.tokenId, entryPrice, finalPrice: token.price, sizeUsd, resultUsd },
    });
    settled++;
  }

  return { checked: open.length, settled };
}
