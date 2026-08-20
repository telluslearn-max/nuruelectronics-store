import "server-only";
import { prisma } from "../prisma";
import { logAdminAction } from "../audit-log";
import { getPolymarketMarketByConditionId, getPolymarketHistoricalPrice } from "./polymarket-client";
import { computeSettlement } from "./trade-policy";
import { SETTLEMENT_STALE_HOURS } from "./config";

export type SettlementResult = { checked: number; settled: number; voided: number; snapshotsLabeled: number };

/**
 * Scores every open position whose market has closed, and labels the
 * candidate-snapshot dataset while it's here.
 *
 * A resolved market's winning outcome token converges to 1 and the losing one
 * to 0, so shares bought at entryPrice are worth shares × finalPrice — the
 * same math as a real payout (see computeSettlement, which is unit-tested
 * rather than only ever exercised against live markets).
 *
 * Positions recorded before entryPrice existed fall back to Polymarket's own
 * price-history API to backfill it rather than sitting unscored forever, and
 * the backfilled value is persisted so the position also starts showing real
 * odds. If even that comes back empty, a loss is still exactly computable — a
 * losing share always pays 0 — and only a win's exact size stays unknown.
 *
 * Two things happen here that didn't before. Markets that close are also used
 * to backfill `resolvedOutcome` on every candidate snapshot for that market,
 * which is what turns the slate the agent priced each hour into a labeled
 * dataset for calibration and counterfactual evaluation. And positions whose
 * market never closes are eventually voided instead of staying open forever,
 * silently understating exposure and blocking their market from being retried.
 */
export async function settleResolvedPositions(): Promise<SettlementResult> {
  const open = await prisma.capitalCirclePosition.findMany({
    where: { resolvedAt: null, status: { in: ["simulated", "executed"] } },
  });

  let settled = 0;
  let voided = 0;
  let snapshotsLabeled = 0;
  const now = new Date();

  for (const position of open) {
    if (!position.tokenId) continue;

    let market;
    try {
      market = await getPolymarketMarketByConditionId(position.marketId);
    } catch (error) {
      console.error(`[capital-circle] settlement lookup failed for ${position.marketId}:`, error);
      continue;
    }

    if (!market || !market.closed) {
      if (await voidIfStale(position, now)) voided++;
      continue;
    }

    const token = market.tokens.find((t) => t.tokenId === position.tokenId);
    if (!token) continue;

    let entryPrice = position.entryPrice != null ? Number(position.entryPrice) : null;
    if (entryPrice == null) {
      entryPrice = await getPolymarketHistoricalPrice(position.tokenId, position.createdAt);
    }

    const { resultUsd, note } = computeSettlement({
      sizeUsd: Number(position.sizeUsd),
      entryPrice,
      finalPrice: token.price,
      feesUsd: position.feesUsd != null ? Number(position.feesUsd) : null,
    });

    await prisma.capitalCirclePosition.update({
      where: { id: position.id },
      data: { resolvedAt: new Date(), resultUsd, entryPrice: entryPrice ?? undefined, exitReason: "resolution" },
    });
    await logAdminAction({
      action: "capital-circle.position.settle",
      entityType: "capital_circle_position",
      entityId: position.id,
      summary: `Capital Circle settled "${position.question}": ${resultUsd >= 0 ? "+" : ""}$${resultUsd.toFixed(2)} (${note}).`,
      metadata: { conditionId: position.marketId, tokenId: position.tokenId, entryPrice, finalPrice: token.price, sizeUsd: Number(position.sizeUsd), resultUsd },
    });
    settled++;

    snapshotsLabeled += await labelSnapshotsForMarket(market.conditionId, market.tokens);
  }

  // Snapshots for markets that were priced but never traded resolve independently of any
  // position, so they need their own sweep — this is the majority of the labeled dataset,
  // and the part that makes calibration free of the model's own selection bias.
  snapshotsLabeled += await labelUntradedSnapshots();

  return { checked: open.length, settled, voided, snapshotsLabeled };
}

/**
 * Closes out a position whose market has sailed past its resolution time
 * without ever reporting closed on Gamma. Booked flat rather than as a loss:
 * the outcome is genuinely unknown, and inventing either sign would corrupt
 * the track record the go-live decision rests on.
 */
async function voidIfStale(position: { id: string; question: string; marketEndDate: Date | null; createdAt: Date }, now: Date): Promise<boolean> {
  const endDate = position.marketEndDate;
  if (!endDate) return false;
  const hoursPastEnd = (now.getTime() - endDate.getTime()) / 3_600_000;
  if (hoursPastEnd < SETTLEMENT_STALE_HOURS) return false;

  await prisma.capitalCirclePosition.update({
    where: { id: position.id },
    data: { resolvedAt: now, resultUsd: 0, exitReason: "voided" },
  });
  await logAdminAction({
    action: "capital-circle.position.void",
    entityType: "capital_circle_position",
    entityId: position.id,
    summary: `Capital Circle voided "${position.question}" — its market passed its resolution time ${hoursPastEnd.toFixed(0)}h ago and never closed. Booked flat.`,
    metadata: { hoursPastEnd },
  }).catch((error) => console.error("[capital-circle] failed to log void:", error));
  return true;
}

/** Marks each snapshot for a closed market with whether its outcome token won. */
async function labelSnapshotsForMarket(conditionId: string, tokens: { tokenId: string; price: number }[]): Promise<number> {
  const pending = await prisma.capitalCircleCandidateSnapshot.findMany({
    where: { marketId: conditionId, resolvedAt: null },
    select: { id: true, tokenId: true },
  });
  if (pending.length === 0) return 0;

  const now = new Date();
  let labeled = 0;
  for (const snapshot of pending) {
    const token = tokens.find((t) => t.tokenId === snapshot.tokenId);
    if (!token) continue;
    await prisma.capitalCircleCandidateSnapshot.update({
      where: { id: snapshot.id },
      // A resolved token sits at 1 or 0; the midpoint is the only sane cut.
      data: { resolvedOutcome: token.price >= 0.5 ? 1 : 0, resolvedAt: now },
    });
    labeled++;
  }
  return labeled;
}

/** How many distinct un-labeled markets to check per run — bounded so the every-minute cron stays cheap. */
const SNAPSHOT_LABEL_BATCH = 20;

async function labelUntradedSnapshots(): Promise<number> {
  const pending = await prisma.capitalCircleCandidateSnapshot.findMany({
    where: { resolvedAt: null },
    select: { marketId: true },
    distinct: ["marketId"],
    orderBy: { createdAt: "asc" },
    take: SNAPSHOT_LABEL_BATCH,
  });

  let labeled = 0;
  for (const { marketId } of pending) {
    try {
      const market = await getPolymarketMarketByConditionId(marketId);
      if (!market?.closed) continue;
      labeled += await labelSnapshotsForMarket(marketId, market.tokens);
    } catch (error) {
      console.error(`[capital-circle] snapshot labeling failed for ${marketId}:`, error);
    }
  }
  return labeled;
}
