export type CycleStatus =
  | { state: "never-run" }
  | { state: "scanning"; startedAtMs: number }
  | { state: "idle"; lastStartedAtMs: number; finishedAtMs: number | null; lastAction: string; lastSummary: string; stale: boolean };

/**
 * agent-loop.ts creates a CapitalCircleCycleLog row the instant a cycle starts and only sets
 * finishedAt once it's done — finishedAt === null is a real, cheap "is a cycle running right now"
 * signal using data that already exists, no new infrastructure needed for it.
 *
 * The one thing that reading has to guard against: a cycle that crashed hard enough to bypass its
 * own finish() call (agent-loop.ts's internal try/catches don't cover literally everything) would
 * leave finishedAt permanently null, which read naively would show "scanning" forever. Past
 * staleAfterMs since startedAt, treat it as a stalled last-attempt instead — same idle
 * presentation, marked `stale` so the caller can phrase it honestly ("last attempt" rather than
 * "last scan").
 */
export function computeCycleStatus(
  mostRecent: { startedAtMs: number; finishedAtMs: number | null; action: string; summary: string } | null,
  nowMs: number,
  staleAfterMs = 10 * 60 * 1000,
): CycleStatus {
  if (!mostRecent) return { state: "never-run" };
  const { startedAtMs, finishedAtMs, action, summary } = mostRecent;

  if (finishedAtMs === null) {
    const ageMs = nowMs - startedAtMs;
    if (ageMs <= staleAfterMs) return { state: "scanning", startedAtMs };
    return { state: "idle", lastStartedAtMs: startedAtMs, finishedAtMs: null, lastAction: action, lastSummary: summary, stale: true };
  }

  return { state: "idle", lastStartedAtMs: startedAtMs, finishedAtMs, lastAction: action, lastSummary: summary, stale: false };
}
