import "server-only";
import { prisma } from "../prisma";
import { BANKROLL_USD, CAPITAL_CIRCLE_LIVE, DAILY_POSITION_TARGET, DEFAULT_PER_POSITION_CAP_USD } from "../capital-circle/config";
import { getTradingUrgency } from "../capital-circle/track-record";
import { isCircleWalletConfigured } from "../capital-circle/circle-wallet-client";
import { computeWeeklySweep, weekStartOf } from "../capital-circle/sweep";
import {
  computeCalibration,
  computeCategoryPerformance,
  type CalibrationReport,
  type CalibrationSample,
  type CategoryPerformance,
} from "../capital-circle/calibration";
import { computeAdaptiveShrinkage } from "../capital-circle/trade-policy";
import { sweepPolicies, type LabeledCandidate, type PolicyOutcome } from "../capital-circle/policy-eval";

export type CapitalCircleReportPosition = {
  id: string;
  question: string;
  thesis: string;
  sizeUsd: number;
  status: string;
  txHash: string | null;
  createdAt: Date;
  entryPrice: number | null;
  confidencePct: number | null;
  resultUsd: number | null;
  resolvedAt: Date | null;
  /** Expected edge at decision time — comparing this against outcomes is how thresholds get tuned from data. */
  edgePct: number | null;
  category: string | null;
  exitReason: string | null;
  exitPrice: number | null;
};

export type CapitalCircleReport = {
  live: boolean;
  positions: CapitalCircleReportPosition[];
  totalSimulatedUsd: number;
  totalExecutedUsd: number;
  /** Sum of resultUsd across every settled position in this page — the top-line "did the desk
   * actually make money" number, distinct from totalSimulatedUsd/totalExecutedUsd (which are
   * capital staked, not profit). Positive is net winning, negative is net losing. */
  totalRealizedPnlUsd: number;
  resolvedCount: number;
  /** Same realized P&L, split by status — simulated P&L is still real (real markets, real prices,
   * just no real money), so it's shown alongside the simulated total the same way executed P&L is
   * shown alongside the executed total, rather than only appearing in the blended figure above. */
  simulatedPnlUsd: number;
  simulatedResolvedCount: number;
  executedPnlUsd: number;
  executedResolvedCount: number;
};

/** The week's decisions — this is the report /admin/reports/capital-circle renders. */
export async function getCapitalCircleReport(limit = 50): Promise<CapitalCircleReport> {
  const positions = await prisma.capitalCirclePosition.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  let totalSimulatedUsd = 0;
  let totalExecutedUsd = 0;
  let totalRealizedPnlUsd = 0;
  let resolvedCount = 0;
  let simulatedPnlUsd = 0;
  let simulatedResolvedCount = 0;
  let executedPnlUsd = 0;
  let executedResolvedCount = 0;
  for (const p of positions) {
    const size = Number(p.sizeUsd);
    if (p.status === "simulated") totalSimulatedUsd += size;
    if (p.status === "executed") totalExecutedUsd += size;
    if (p.resolvedAt && p.resultUsd != null) {
      const resultUsd = Number(p.resultUsd);
      totalRealizedPnlUsd += resultUsd;
      resolvedCount++;
      if (p.status === "simulated") {
        simulatedPnlUsd += resultUsd;
        simulatedResolvedCount++;
      }
      if (p.status === "executed") {
        executedPnlUsd += resultUsd;
        executedResolvedCount++;
      }
    }
  }

  return {
    live: CAPITAL_CIRCLE_LIVE && isCircleWalletConfigured,
    totalRealizedPnlUsd,
    resolvedCount,
    simulatedPnlUsd,
    simulatedResolvedCount,
    executedPnlUsd,
    executedResolvedCount,
    positions: positions.map((p) => ({
      id: p.id,
      question: p.question,
      thesis: p.thesis,
      sizeUsd: Number(p.sizeUsd),
      status: p.status,
      txHash: p.txHash,
      createdAt: p.createdAt,
      entryPrice: p.entryPrice != null ? Number(p.entryPrice) : null,
      confidencePct: p.confidencePct,
      resultUsd: p.resultUsd != null ? Number(p.resultUsd) : null,
      resolvedAt: p.resolvedAt,
      edgePct: p.edgePct != null ? Number(p.edgePct) : null,
      category: p.category,
      exitReason: p.exitReason,
      exitPrice: p.exitPrice != null ? Number(p.exitPrice) : null,
    })),
    totalSimulatedUsd,
    totalExecutedUsd,
  };
}

export type CapitalCircleIntelligenceReport = {
  calibration: CalibrationReport;
  categories: CategoryPerformance[];
  /** The shrinkage λ currently derived from that calibration — how much the code trusts the model right now. */
  shrinkage: { lambda: number; reason: string };
  /** Counterfactual sweep over resolved candidates: what other thresholds would have earned. */
  policySweep: PolicyOutcome[];
  /** How many labeled candidates the sweep had to work with. Below ~50 the table is suggestive, not conclusive. */
  labeledCandidateCount: number;
  recentCycles: {
    id: string;
    startedAt: Date;
    action: string;
    summary: string;
    candidateCount: number;
    hadNews: boolean;
  }[];
  /** Trades the edge gate refused. A rising share means the model's estimates are drifting from prices without justification. */
  edgeRejectedCount: number;
  circuitBreaker: { paused: boolean; reason: string | null; since: Date | null };
  /** Progress against the daily position target, and the edge bar that follows from it. */
  urgency: { positionsToday: number; dailyTarget: number; hoursSinceLastPosition: number | null; minEdge: number; hungry: boolean; reason: string };
};

/**
 * The measurement layer: is this thing actually any good?
 *
 * Realized P&L over a few dozen short-horizon bets is mostly noise, so the
 * report deliberately leads with calibration (is the model's 70% a real 70%?)
 * and with the counterfactual sweep (would a different threshold have done
 * better on the same markets?). Those answer the go-live question far sooner
 * than the P&L line does, and they're computed over every candidate the agent
 * priced, not only the ones it chose to trade.
 */
export async function getCapitalCircleIntelligenceReport(): Promise<CapitalCircleIntelligenceReport> {
  const [snapshots, cycles, edgeRejectedCount, wallet, urgency] = await Promise.all([
    prisma.capitalCircleCandidateSnapshot.findMany({
      where: { resolvedOutcome: { not: null }, modelProbability: { not: null } },
      orderBy: { resolvedAt: "desc" },
      take: 500,
    }),
    prisma.capitalCircleCycleLog.findMany({ orderBy: { startedAt: "desc" }, take: 20 }),
    prisma.capitalCirclePosition.count({ where: { status: "edge_rejected" } }),
    prisma.capitalCircleWallet.findFirst({ where: { status: "active" }, orderBy: { createdAt: "desc" } }),
    getTradingUrgency(),
  ]);

  const samples: CalibrationSample[] = snapshots.map((snapshot) => ({
    probability: Number(snapshot.modelProbability),
    outcome: snapshot.resolvedOutcome === 1 ? 1 : 0,
    category: snapshot.category,
  }));

  const calibration = computeCalibration(samples);
  const labeled: LabeledCandidate[] = snapshots.map((snapshot) => ({
    marketId: snapshot.marketId,
    tokenId: snapshot.tokenId,
    category: snapshot.category,
    modelProbability: Number(snapshot.modelProbability),
    bestAsk: snapshot.bestAsk != null ? Number(snapshot.bestAsk) : null,
    // Snapshots record the market price at scoring time; the sweep prices entries from it the
    // same way the live path does, so its numbers stay comparable to the real P&L series.
    midpoint: snapshot.bestBid != null && snapshot.bestAsk != null ? (Number(snapshot.bestBid) + Number(snapshot.bestAsk)) / 2 : null,
    spread: snapshot.spread != null ? Number(snapshot.spread) : null,
    outcome: snapshot.resolvedOutcome === 1 ? 1 : 0,
  }));

  return {
    calibration,
    categories: computeCategoryPerformance(samples),
    shrinkage: computeAdaptiveShrinkage({
      sampleCount: calibration.sampleCount,
      meanAbsCalibrationError: calibration.meanAbsCalibrationError,
    }),
    policySweep: labeled.length > 0 ? sweepPolicies(labeled, { capUsd: DEFAULT_PER_POSITION_CAP_USD, bankrollUsd: BANKROLL_USD }).slice(0, 10) : [],
    labeledCandidateCount: labeled.length,
    recentCycles: cycles.map((cycle) => ({
      id: cycle.id,
      startedAt: cycle.startedAt,
      action: cycle.action,
      summary: cycle.summary,
      candidateCount: cycle.candidateCount,
      hadNews: Boolean(cycle.newsContext),
    })),
    edgeRejectedCount,
    circuitBreaker: { paused: Boolean(wallet?.pausedAt), reason: wallet?.pausedReason ?? null, since: wallet?.pausedAt ?? null },
    urgency: {
      positionsToday: urgency.positionsToday,
      dailyTarget: DAILY_POSITION_TARGET,
      hoursSinceLastPosition: urgency.hoursSinceLastPosition,
      minEdge: urgency.minEdge,
      hungry: urgency.hungry,
      reason: urgency.reason,
    },
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
  pausedAt: Date | null;
  pausedReason: string | null;
  createdAt: Date;
  /** For evaluateIdentityChange's optimistic-concurrency check — must reach the identity form as a plain number. */
  updatedAtMs: number;
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
    pausedAt: w.pausedAt,
    pausedReason: w.pausedReason,
    createdAt: w.createdAt,
    updatedAtMs: w.updatedAt.getTime(),
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
