import "server-only";
import { prisma } from "../prisma";
import {
  computeCalibration,
  computeCategoryPerformance,
  detectAssignmentInversion,
  type CalibrationReport,
  type CalibrationSample,
  type CategoryPerformance,
  type InversionReport,
} from "./calibration";
import { computeAdaptiveShrinkage, computeUrgency, type Urgency } from "./trade-policy";
import {
  CALIBRATION_SAMPLE_LIMIT,
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

/**
 * Calibration reads further back than the position history above, and reads exactly as far as
 * the admin report does — see CALIBRATION_SAMPLE_LIMIT. The two used to differ (200 here, 500
 * there), which meant the λ on the dashboard was computed from a different population than the λ
 * gating real trades, while both were labelled the same thing.
 */
const CALIBRATION_LIMIT = CALIBRATION_SAMPLE_LIMIT;
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
  /**
   * Whether the track record shows probabilities recorded against the wrong outcome.
   * Read before anything else here: if this fires, every other number in this object is
   * describing something other than what it claims to.
   */
  inversion: InversionReport;
  categories: CategoryPerformance[];
  /** The λ that adaptive shrinkage derived from the calibration above — what this cycle will actually size with. */
  shrinkage: { lambda: number; reason: string; halted: boolean };
  /**
   * Same shrinkage computation as `shrinkage`, run separately per category instead of pooled
   * across the whole track record — a topic the model has been chronically overconfident on
   * shouldn't drag down trust in one it's genuinely good at, or vice versa. Keyed by the same
   * category strings `categories` uses. A category below MIN_SAMPLES_FOR_ADAPTIVE_SHRINKAGE
   * naturally falls back to the KELLY_SHRINKAGE prior via computeAdaptiveShrinkage itself, same as
   * the pooled figure does before enough history exists at all. Shares the same `inverted` flag
   * as the pooled `shrinkage` above rather than detecting inversion per category: an assignment
   * inversion is a pipeline bug (probabilities paired with the wrong outcome), not a per-topic
   * property, so every category halts together — a category-scoped λ that stayed confidently high
   * while the pooled figure had already halted would defeat the whole point of halting.
   */
  categoryShrinkage: Record<string, { lambda: number; reason: string; halted: boolean }>;
  recentLosses: {
    question: string;
    thesis: string;
    entryPrice: number | null;
    resultUsd: number;
    /** The model's own stated confidence in this thesis, 0-100 — lets a loss be read against
     * what it was actually confident of, not just the aggregate bias number. */
    confidencePct: number | null;
    /** resolution | take_profit | stop | voided | null (older rows predate this field). A
     * stop-loss or take-profit-gone-wrong loss means the entry thesis broke down fast — a
     * different failure mode than one that ran to resolution and simply didn't hit. */
    exitReason: string | null;
  }[];
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
      take: CALIBRATION_LIMIT,
    }),
  ]);

  const wins = resolved.filter((position) => Number(position.resultUsd ?? 0) > 0).length;
  const sumResult = (rows: typeof resolved) => rows.reduce((total, row) => total + Number(row.resultUsd ?? 0), 0);

  const calibrationSamples: CalibrationSample[] = snapshots.map((snapshot) => ({
    probability: Number(snapshot.modelProbability),
    outcome: snapshot.resolvedOutcome === 1 ? 1 : 0,
    category: snapshot.category,
    shownPrice: snapshot.shownPrice != null ? Number(snapshot.shownPrice) : null,
  }));

  const calibration = computeCalibration(calibrationSamples);
  // Run against the full report rather than the passthrough-filtered one: a mis-paired
  // estimate is still a mis-paired estimate whether or not the number came from the price,
  // and this is the check whose answer decides whether the rest is usable at all.
  const inversion = detectAssignmentInversion(calibration);
  const shrinkage = computeAdaptiveShrinkage({
    sampleCount: calibration.sampleCount,
    meanAbsCalibrationError: calibration.meanAbsCalibrationError,
    inverted: inversion.inverted,
    invertedDetail: inversion.detail,
  });
  const categories = computeCategoryPerformance(calibrationSamples);
  const categoryShrinkage: TrackRecord["categoryShrinkage"] = {};
  for (const category of categories) {
    categoryShrinkage[category.category] = computeAdaptiveShrinkage({
      sampleCount: category.count,
      meanAbsCalibrationError: category.meanAbsCalibrationError,
      // Same pooled inversion flag as `shrinkage` above — see categoryShrinkage's own comment.
      inverted: inversion.inverted,
      invertedDetail: inversion.detail,
    });
  }

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
    inversion,
    categories,
    shrinkage,
    categoryShrinkage,
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
        confidencePct: position.confidencePct,
        exitReason: position.exitReason,
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
      `Track record: ${record.wins}/${record.resolvedCount} resolved positions won (${((record.winRate ?? 0) * 100).toFixed(1)}%), realized P&L $${record.realizedPnlUsd.toFixed(2)}.`,
    );
  }

  // Stated before the scores themselves, because it changes what they mean. It is also
  // the one line here the model can act on directly: the fix is entirely in how carefully
  // it pairs each ref with the outcome name on the same line.
  if (record.inversion.inverted) {
    lines.push(
      `INTEGRITY WARNING: across ${record.inversion.sampleCount} resolved predictions, ${(record.inversion.invertedShare * 100).toFixed(0)}% are better explained by the probability having been attached to the OPPOSITE outcome of the market than by the one it was recorded against. ` +
        `Until that clears, take extra care that every estimate's ref and outcome name come from the same line — a probability paired with the other side's price is the most expensive error available here.`,
    );
  }

  const { calibration } = record;
  if (calibration.passthroughShare != null && calibration.passthroughShare >= 0.5) {
    lines.push(
      `Note: ${(calibration.passthroughShare * 100).toFixed(0)}% of your scored predictions were the market price you were shown, returned unchanged. Those measure the market, not you — they cannot produce a trade and they tell nobody whether your forecasting is any good.`,
    );
  }
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
      // Win rate alone can look fine on a category of correctly-priced coin flips and bad on one
      // of well-called longshots — Brier score is the one that actually says whether the
      // probabilities in that category mean anything, so both travel together here.
      `By topic: ${meaningfulCategories
        .map(
          (category) =>
            `${category.category} ${(category.winRate * 100).toFixed(0)}% over ${category.count}${
              category.brierScore != null ? ` (Brier ${category.brierScore.toFixed(3)})` : ""
            }`,
        )
        .join("; ")}. Weight your confidence accordingly — you are not equally good at all of these.`,
    );
  }

  if (record.recentLosses.length > 0) {
    lines.push(
      `Recent losses to learn from:\n${record.recentLosses
        .map((loss) => {
          const said = loss.confidencePct != null ? `, said ${loss.confidencePct}% confident` : "";
          const how =
            loss.exitReason === "stop" || loss.exitReason === "take_profit"
              ? " — stopped out early, thesis broke down fast"
              : loss.exitReason === "resolution"
                ? " — held to resolution, simply didn't happen"
                : "";
          return `  - "${loss.question}" (entry ${loss.entryPrice ?? "?"}${said}, ${loss.resultUsd.toFixed(2)}${how}): ${loss.thesis}`;
        })
        .join("\n")}`,
    );
  }

  if (record.openPositions.length > 0) {
    lines.push(
      `Currently open (do not duplicate these — the code will refuse them anyway): ${record.openPositions
        .map((position) => `"${position.question}" ($${position.sizeUsd.toFixed(2)} at ${position.entryPrice ?? "?"}, held ${position.hoursHeld}h)`)
        .join("; ")}. Total open exposure $${record.openExposureUsd.toFixed(2)}.`,
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
