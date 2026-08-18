import "server-only";
import { prisma } from "../prisma";
import { logAdminAction } from "../audit-log";
import { computePnl } from "../reports/pnl";
import { CAPITAL_CIRCLE_SWEEP_PERCENT } from "./config";

/** Monday 00:00 UTC on-or-before the given date. */
export function weekStartOf(date: Date): Date {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = start.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  const daysSinceMonday = (day + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return start;
}

function weekEndOf(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setUTCDate(end.getUTCDate() + 7);
  return end;
}

/**
 * Sums computePnl()'s daily profit buckets across the Mon–Sun window rather
 * than reimplementing profit calculation — same revenue (Receipts + Shopify)
 * and expense logic the P&L page/CSV/Sheets sync already use.
 */
export async function computeWeeklySweep(
  weekStart: Date,
): Promise<{ weekStart: Date; weekEnd: Date; totalProfitUsd: number; sweepAmountUsd: number }> {
  const weekEnd = weekEndOf(weekStart);
  const pnl = await computePnl({ from: weekStart, to: weekEnd, granularity: "daily" });
  const totalProfitUsd = pnl.buckets.reduce((sum, bucket) => sum + (pnl.profit[bucket] ?? 0), 0);
  const sweepAmountUsd = Math.max(0, totalProfitUsd) * (CAPITAL_CIRCLE_SWEEP_PERCENT / 100);
  return { weekStart, weekEnd, totalProfitUsd, sweepAmountUsd };
}

/**
 * Idempotent on weekStart — safe to re-run the cron for a week that already
 * has a pending sweep (upserts rather than duplicating). A week with zero or
 * negative profit still gets an explicit sweepAmountUsd: 0 row rather than
 * being skipped, mirroring the trading agent's own "no trade is a valid
 * outcome" stance.
 */
export async function recordPendingSweep(weekStart: Date) {
  const { weekEnd, totalProfitUsd, sweepAmountUsd } = await computeWeeklySweep(weekStart);

  // Same lookup sizePosition() uses, so a sweep is linked to whichever wallet
  // is actually active right now — needed for the webhook (route.ts under
  // /api/webhooks/circle) to know which pending sweep a deposit belongs to.
  const activeWallet = await prisma.capitalCircleWallet.findFirst({
    where: { status: "active" },
    orderBy: { createdAt: "desc" },
  });

  const sweep = await prisma.capitalCircleSweep.upsert({
    where: { weekStart },
    update: { walletId: activeWallet?.id ?? null },
    create: {
      weekStart,
      weekEnd,
      totalProfitUsd,
      splitPercent: CAPITAL_CIRCLE_SWEEP_PERCENT,
      sweepAmountUsd,
      status: "pending",
      walletId: activeWallet?.id ?? null,
    },
  });

  await logAdminAction({
    action: "capital-circle.sweep.propose",
    entityType: "capital_circle_sweep",
    entityId: sweep.id,
    summary: `Capital Circle sweep proposed for week of ${weekStart.toISOString().slice(0, 10)}: $${sweepAmountUsd.toFixed(2)} (${CAPITAL_CIRCLE_SWEEP_PERCENT}% of $${totalProfitUsd.toFixed(2)} profit) — awaiting manual USD→USDC conversion and confirmation.`,
    metadata: { weekStart: weekStart.toISOString(), totalProfitUsd, sweepAmountUsd },
  });

  return sweep;
}
