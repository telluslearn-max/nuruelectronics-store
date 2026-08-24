import "server-only";
import { prisma } from "../prisma";
import { formatPrice } from "../format";
import { computeCalibration, computeCategoryPerformance, type CalibrationReport, type CalibrationSample, type CategoryPerformance } from "./calibration";
import { computeAdaptiveShrinkage, computeUrgency, type Urgency } from "./trade-policy";
import {
  DAILY_POSITION_TARGET,
  HUNGRY_AFTER_HOURS,
  MIN_EDGE,
  MIN_EDGE_WHEN_HUNGRY,
  STARVING_AFTER_HOURS,
} from "./config";

/**
 * What the agent knows about its own past, assembled fresh each cycle.
 *
 * The old loop started every hour from zero: no memory of what it had traded,
 * what had worked, or whether its confidence numbers meant anything. It could
 * not learn, because nothing ever told it what happened. This module is the
 * feedback path — injected into the scoring prompt (so the model can correct
 * itself) and consumed by adaptive shrinkage (so the code corrects for the
 * model regardless of whether it does).
 *
 * Calibration is measured over candidate snapshots rather than taken
 * positions: snapshots include the markets that were passed on, so the sample
 * isn't filtered by the same judgement being scored.
 */

/** Enough history to be meaningful, bounded so a long-running pool doesn't grow the query without limit. */
const HISTORY_LIMIT = 200;
const RECENT_LOSSES_SHOWN = 5;

export type OpenPositionSummary = {
  marketId: string;
  eventId: string | null;
  question: string;
  entryPrice: number | null;
  sizeUsd: number;
  hoursHeld: number;
};

export type TrackRecord = {
  resolvedCount: number;
  wins: number;
  winRate: number | null;
  realizedPnlUsd: number;
  simulatedPnlUsd: number;
  executedPnlUsd: number;
  calibration: CalibrationReport;
  categories: CategoryPerformance[];
  /** The λ that adaptive shrinkage derived from the calibration above — what this cycle will actually size with. */
  shrinkage: { lambda: number; reason: string };
  recentLosses: { question: string; thesis: string; entryPrice: number | null; resultUsd: number }[];
  openPositions: OpenPositionSummary[];
  openExposureUsd: number;
};

export async function getTrackRecord(): Promise<TrackRecord> {
  const [resolved, open, snapshots] = await Promise.all([
    prisma.capitalCirclePosition.findMany({
      where: { resolvedAt: { not: null }, status: { in: ["simulated", "executed", "exited"] } },
      orderBy: { resolvedAt: "desc" },
      take: HISTORY_LIMIT,
    }),
    prisma.capitalCirclePosition.findMany({
      where: { resolvedAt: null, status: { in: ["simulated", "executed"] } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.capitalCircleCandidateSnapshot.findMany({
      where: { resolvedOutcome: { not: null }, modelProbability: { not: null } },
      orderBy: { resolvedAt: "desc" },
      take: HISTORY_LIMIT,
    }),
  ]);

  const wins = resolved.filter((position) => Number(position.resultUsd ?? 0) > 0).length;
  const sumResult = (rows: typeof resolved) => rows.reduce((total, row) => total + Number(row.resultUsd ?? 0), 0);

  const calibrationSamples: CalibrationSample[] = snapshots.map((snapshot) => ({
    probability: Number(snapshot.modelProbability),
    outcome: snapshot.resolvedOutcome === 1 ? 1 : 0,
    category: snapshot.category,
  }));

  const calibration = computeCalibration(calibrationSamples);
  const shrinkage = computeAdaptiveShrinkage({
    sampleCount: calibration.sampleCount,
    meanAbsCalibrationError: calibration.meanAbsCalibrationError,
  });

  const now = Date.now();
  const openPositions: OpenPositionSummary[] = open.map((position) => ({
    marketId: position.marketId,
    eventId: position.eventId,
    question: position.question,
    entryPrice: position.entryPrice != null ? Number(position.entryPrice) : null,
    sizeUsd: Number(position.sizeUsd),
    hoursHeld: Number(((now - position.createdAt.getTime()) / 3_600_000).toFixed(2)),
  }));

  return {
    resolvedCount: resolved.length,
    wins,
    winRate: resolved.length > 0 ? round4(wins / resolved.length) : null,
    realizedPnlUsd: round2(sumResult(resolved)),
    simulatedPnlUsd: round2(sumResult(resolved.filter((position) => position.status === "simulated"))),
    executedPnlUsd: round2(sumResult(resolved.filter((position) => position.status === "executed"))),
    calibration,
    categories: computeCategoryPerformance(calibrationSamples),
    shrinkage,
    recentLosses: resolved
      .filter((position) => Number(position.resultUsd ?? 0) < 0)
      .slice(0, RECENT_LOSSES_SHOWN)
      .map((position) => ({
        question: position.question,
        // Enough of the thesis to recognise the failure mode, not so much that five of them
        // crowd out the actual market list in the prompt.
        thesis: position.thesis.slice(0, 200),
        entryPrice: position.entryPrice != null ? Number(position.entryPrice) : null,
        resultUsd: Number(position.resultUsd ?? 0),
      })),
    openPositions,
    openExposureUsd: round2(openPositions.reduce((total, position) => total + position.sizeUsd, 0)),
  };
}

/**
 * How badly the desk needs a trade right now.
 *
 * Counts only positions that actually reached the book (simulated or executed)
 * — a cap-rejection or an edge-rejection is not a position, and counting one
 * toward the daily target would let the desk satisfy its quota by refusing
 * trades, which is precisely backwards.
 */
export async function getTradingUrgency(now = new Date()): Promise<Urgency & { hoursSinceLastPosition: number | null; positionsToday: number }> {
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const [lastPosition, positionsToday] = await Promise.all([
    prisma.capitalCirclePosition.findFirst({
      where: { status: { in: ["simulated", "executed", "exited"] } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.capitalCirclePosition.count({
      where: { status: { in: ["simulated", "executed", "exited"] }, createdAt: { gte: dayStart } },
    }),
  ]);

  const hoursSinceLastPosition = lastPosition ? (now.getTime() - lastPosition.createdAt.getTime()) / 3_600_000 : null;

  const urgency = computeUrgency({
    hoursSinceLastPosition,
    positionsToday,
    dailyTarget: DAILY_POSITION_TARGET,
    baseMinEdge: MIN_EDGE,
    hungryMinEdge: MIN_EDGE_WHEN_HUNGRY,
    hungryAfterHours: HUNGRY_AFTER_HOURS,
    starvingAfterHours: STARVING_AFTER_HOURS,
  });

  return { ...urgency, hoursSinceLastPosition, positionsToday };
}

/**
 * The track record as prompt text. Written as plain prose because that's what
 * the model reads best, and deliberately blunt about overconfidence: telling a
 * model "your 80% calls happen 55% of the time" is the single most useful
 * correction available, and it costs nothing to include.
 */
export function renderTrackRecordForPrompt(record: TrackRecord): string {
  const lines: string[] = [];

  if (record.resolvedCount === 0) {
    lines.push("Track record: nothing has resolved yet — this is early, so state honest probabilities rather than reaching for a trade.");
  } else {
    lines.push(
      `Track record: ${record.wins}/${record.resolvedCount} resolved positions won (${((record.winRate ?? 0) * 100).toFixed(1)}%), realized P&L ${formatPrice(String(record.realizedPnlUsd), "USD")}.`,
    );
  }

  const { calibration } = record;
  if (calibration.sampleCount > 0 && calibration.brierScore != null) {
    lines.push(
      `Calibration over ${calibration.sampleCount} scored predictions: Brier ${calibration.brierScore.toFixed(3)} (always predicting the base rate would score ${calibration.baseRateBrier?.toFixed(3) ?? "n/a"}${
        calibration.skillScore != null ? `, so your skill score is ${calibration.skillScore.toFixed(3)}` : ""
      }).`,
    );
    if (calibration.meanBias != null && Math.abs(calibration.meanBias) > 0.03) {
      lines.push(
        calibration.meanBias > 0
          ? `You are running ${(calibration.meanBias * 100).toFixed(1)} points OVERCONFIDENT on average — your stated probabilities are systematically too high. Correct for this.`
          : `You are running ${(Math.abs(calibration.meanBias) * 100).toFixed(1)} points UNDERconfident on average — your stated probabilities are systematically too low.`,
      );
    }
    const populated = calibration.buckets.filter((bucket) => bucket.count >= 3);
    if (populated.length > 0) {
      lines.push(
        `By confidence band (predicted vs actual): ${populated
          .map((bucket) => `${bucket.label} → ${(bucket.actualRate * 100).toFixed(0)}% actual (n=${bucket.count})`)
          .join("; ")}.`,
      );
    }
  }

  const meaningfulCategories = record.categories.filter((category) => category.count >= 5);
  if (meaningfulCategories.length > 0) {
    lines.push(
      `By topic: ${meaningfulCategories
        .map((category) => `${category.category} ${(category.winRate * 100).toFixed(0)}% over ${category.count}`)
        .join("; ")}. Weight your confidence accordingly — you are not equally good at all of these.`,
    );
  }

  if (record.recentLosses.length > 0) {
    lines.push(
      `Recent losses to learn from:\n${record.recentLosses
        .map((loss) => `  - "${loss.question}" (entry ${loss.entryPrice ?? "?"}, ${loss.resultUsd.toFixed(2)}): ${loss.thesis}`)
        .join("\n")}`,
    );
  }

  if (record.openPositions.length > 0) {
    lines.push(
      `Currently open (do not duplicate these — the code will refuse them anyway): ${record.openPositions
        .map((position) => `"${position.question}" (${formatPrice(String(position.sizeUsd), "USD")} at ${position.entryPrice ?? "?"}, held ${position.hoursHeld}h)`)
        .join("; ")}. Total open exposure ${formatPrice(String(record.openExposureUsd), "USD")}.`,
    );
  } else {
    lines.push("No positions are currently open.");
  }

  return lines.join("\n");
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
