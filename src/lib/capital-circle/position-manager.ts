import "server-only";
import { prisma } from "../prisma";
import { formatPrice } from "../format";
import { logAdminAction } from "../audit-log";
import { getOrderBookSummary } from "./polymarket-client";
import { evaluateExit, computeSettlement } from "./trade-policy";
import { CAPITAL_CIRCLE_LIVE, STOP_LOSS_FRACTION, TAKE_PROFIT_PRICE } from "./config";

export type PositionManagementResult = { checked: number; exited: number };

/**
 * Manages open positions between entry and resolution.
 *
 * Every position used to be held to resolution unconditionally, which is two
 * distinct leaks. A token that has already run to 0.97 keeps a full-size
 * downside on the table in exchange for three cents of remaining upside — a
 * terrible risk-reward that the original entry thesis never argued for. And a
 * token whose thesis has visibly broken rides all the way to zero when half
 * the stake was still recoverable. Both are fixed by checking prices on the
 * settlement cron, which already runs every minute.
 *
 * Exits are booked at the *bid* — the side a seller actually crosses — for the
 * same reason entries are booked at the ask: a simulated track record that
 * quietly assumes midpoint fills on both legs is not a track record anyone
 * should risk real money on.
 */
export async function manageOpenPositions(): Promise<PositionManagementResult> {
  const open = await prisma.capitalCirclePosition.findMany({
    where: { resolvedAt: null, status: { in: ["simulated", "executed"] } },
  });

  let exited = 0;
  for (const position of open) {
    if (!position.tokenId) continue;

    const book = await getOrderBookSummary(position.tokenId);
    // Price the exit at the bid; fall back to the midpoint only when there are no resting bids
    // at all, in which case there is effectively nothing to sell into anyway.
    const exitPrice = book?.bestBid ?? book?.midpoint ?? null;
    if (exitPrice == null) continue;

    const entryPrice = position.entryPrice != null ? Number(position.entryPrice) : null;
    const decision = evaluateExit({
      entryPrice,
      currentPrice: exitPrice,
      takeProfitPrice: TAKE_PROFIT_PRICE,
      stopLossFraction: STOP_LOSS_FRACTION,
    });
    if (!decision.shouldExit) continue;

    // Live selling isn't wired up yet: Phase B needs the same mainnet wallet the buy side is
    // waiting on. Until then an executed position stays held rather than being marked exited
    // against a sale that never happened — a fake exit would be worse than a missed one.
    if (position.status === "executed" && CAPITAL_CIRCLE_LIVE) {
      console.warn(`[capital-circle] exit signalled for live position ${position.id} but live selling is not implemented; holding.`);
      continue;
    }

    const { resultUsd, note } = computeSettlement({
      sizeUsd: Number(position.sizeUsd),
      entryPrice,
      // Selling at `exitPrice` realizes exactly what the shares are worth at that price.
      finalPrice: exitPrice,
      feesUsd: position.feesUsd != null ? Number(position.feesUsd) : null,
    });

    await prisma.capitalCirclePosition.update({
      where: { id: position.id },
      data: { status: "exited", resolvedAt: new Date(), resultUsd, exitPrice, exitReason: decision.reason },
    });
    await logAdminAction({
      action: "capital-circle.position.exit",
      entityType: "capital_circle_position",
      entityId: position.id,
      summary: `Capital Circle exited "${position.question}" at ${exitPrice.toFixed(4)} (${decision.reason}): ${resultUsd >= 0 ? "+" : ""}${formatPrice(String(resultUsd), "USD")}. ${decision.note}`,
      metadata: { exitPrice, entryPrice, reason: decision.reason, resultUsd, settlementNote: note },
    }).catch((error) => console.error("[capital-circle] failed to log exit:", error));
    exited++;
  }

  return { checked: open.length, exited };
}
