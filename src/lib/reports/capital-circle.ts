import "server-only";
import { prisma } from "../prisma";
import { CAPITAL_CIRCLE_LIVE } from "../capital-circle/config";
import { isCircleWalletConfigured } from "../capital-circle/circle-wallet-client";
import { computeWeeklySweep, weekStartOf } from "../capital-circle/sweep";

export type CapitalCircleReportPosition = {
  id: string;
  question: string;
  thesis: string;
  sizeUsd: number;
  status: string;
  txHash: string | null;
  createdAt: Date;
};

export type CapitalCircleReport = {
  live: boolean;
  positions: CapitalCircleReportPosition[];
  totalSimulatedUsd: number;
  totalExecutedUsd: number;
};

/** The week's decisions — this is the report /admin/reports/capital-circle renders. */
export async function getCapitalCircleReport(limit = 50): Promise<CapitalCircleReport> {
  const positions = await prisma.capitalCirclePosition.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  let totalSimulatedUsd = 0;
  let totalExecutedUsd = 0;
  for (const p of positions) {
    const size = Number(p.sizeUsd);
    if (p.status === "simulated") totalSimulatedUsd += size;
    if (p.status === "executed") totalExecutedUsd += size;
  }

  return {
    live: CAPITAL_CIRCLE_LIVE && isCircleWalletConfigured,
    positions: positions.map((p) => ({
      id: p.id,
      question: p.question,
      thesis: p.thesis,
      sizeUsd: Number(p.sizeUsd),
      status: p.status,
      txHash: p.txHash,
      createdAt: p.createdAt,
    })),
    totalSimulatedUsd,
    totalExecutedUsd,
  };
}

export type CapitalCircleWalletSummary = {
  id: string;
  circleWalletId: string | null;
  address: string | null;
  chain: string;
  status: string;
  perTxCapUsd: number | null;
  dailyCapUsd: number | null;
  weeklyCapUsd: number | null;
  monthlyCapUsd: number | null;
  createdAt: Date;
};

/** All registered wallet rows, newest first — usually 0 or 1, but kept as a list to survive wallet rotation. */
export async function getCapitalCircleWallets(): Promise<CapitalCircleWalletSummary[]> {
  const wallets = await prisma.capitalCircleWallet.findMany({ orderBy: { createdAt: "desc" } });
  return wallets.map((w) => ({
    id: w.id,
    circleWalletId: w.circleWalletId,
    address: w.address,
    chain: w.chain,
    status: w.status,
    perTxCapUsd: w.perTxCapUsd != null ? Number(w.perTxCapUsd) : null,
    dailyCapUsd: w.dailyCapUsd != null ? Number(w.dailyCapUsd) : null,
    weeklyCapUsd: w.weeklyCapUsd != null ? Number(w.weeklyCapUsd) : null,
    monthlyCapUsd: w.monthlyCapUsd != null ? Number(w.monthlyCapUsd) : null,
    createdAt: w.createdAt,
  }));
}

export type CapitalCircleSweepSummary = {
  id: string;
  weekStart: Date;
  weekEnd: Date;
  totalProfitUsd: number;
  splitPercent: number;
  sweepAmountUsd: number;
  status: string;
  detectedUsdcAmount: number | null;
  detectedAt: Date | null;
  confirmedUsdcAmount: number | null;
  confirmedAt: Date | null;
};

/** Sweeps awaiting a manual USD→USDC conversion + confirmation — the "Pending Sweeps" section of the admin page. */
export async function getPendingSweeps(limit = 20): Promise<CapitalCircleSweepSummary[]> {
  const sweeps = await prisma.capitalCircleSweep.findMany({
    where: { status: "pending" },
    orderBy: { weekStart: "desc" },
    take: limit,
  });
  return sweeps.map((s) => ({
    id: s.id,
    weekStart: s.weekStart,
    weekEnd: s.weekEnd,
    totalProfitUsd: Number(s.totalProfitUsd),
    splitPercent: Number(s.splitPercent),
    sweepAmountUsd: Number(s.sweepAmountUsd),
    status: s.status,
    detectedUsdcAmount: s.detectedUsdcAmount ? Number(s.detectedUsdcAmount) : null,
    detectedAt: s.detectedAt,
    confirmedUsdcAmount: s.confirmedUsdcAmount ? Number(s.confirmedUsdcAmount) : null,
    confirmedAt: s.confirmedAt,
  }));
}

export type WeeklyComparisonRow = {
  weekStart: Date;
  weekEnd: Date;
  corePnlUsd: number;
  sweptUsd: number;
  sweepStatus: "confirmed" | "pending" | "none";
  aiPositionsResultUsd: number;
  aiPositionsOpenUsd: number;
};

/**
 * The concept's "friendly competition" signal: the core business's weekly
 * profit next to the AI pot's weekly realized result, trailing N weeks
 * (newest first). corePnlUsd reuses computeWeeklySweep()'s computePnl() sum
 * rather than recomputing it, so this always agrees with the sweep numbers
 * on /admin/reports/capital-circle. aiPositionsOpenUsd is a single current
 * snapshot (not reconstructed per-week), repeated on every row — how much
 * exposure the pot is carrying right now, for context alongside the history.
 */
export async function getWeeklyComparisonReport(weeks = 8): Promise<WeeklyComparisonRow[]> {
  const currentWeekStart = weekStartOf(new Date());
  const rows: WeeklyComparisonRow[] = [];

  for (let i = 1; i <= weeks; i++) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setUTCDate(weekStart.getUTCDate() - 7 * i);
    const { weekEnd, totalProfitUsd } = await computeWeeklySweep(weekStart);

    const sweep = await prisma.capitalCircleSweep.findUnique({ where: { weekStart } });
    const sweptUsd = sweep ? Number(sweep.confirmedUsdcAmount ?? sweep.sweepAmountUsd) : 0;
    const sweepStatus: WeeklyComparisonRow["sweepStatus"] = !sweep ? "none" : sweep.status === "confirmed" ? "confirmed" : "pending";

    const resolvedPositions = await prisma.capitalCirclePosition.findMany({
      where: { resolvedAt: { gte: weekStart, lt: weekEnd } },
    });
    const aiPositionsResultUsd = resolvedPositions.reduce((sum, p) => sum + Number(p.resultUsd ?? 0), 0);

    rows.push({ weekStart, weekEnd, corePnlUsd: totalProfitUsd, sweptUsd, sweepStatus, aiPositionsResultUsd, aiPositionsOpenUsd: 0 });
  }

  const openPositions = await prisma.capitalCirclePosition.findMany({
    where: { resolvedAt: null, status: { in: ["simulated", "executed"] } },
  });
  const aiPositionsOpenUsd = openPositions.reduce((sum, p) => sum + Number(p.sizeUsd), 0);
  for (const row of rows) row.aiPositionsOpenUsd = aiPositionsOpenUsd;

  return rows;
}
