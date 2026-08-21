import { describe, expect, it } from "vitest";
import { computeCycleStatus } from "./cycle-status";

const NOW = 1_000_000_000;

describe("computeCycleStatus", () => {
  it("is never-run when no cycle has ever been logged", () => {
    expect(computeCycleStatus(null, NOW)).toEqual({ state: "never-run" });
  });

  it("is scanning when the most recent cycle started and hasn't finished, within the stale window", () => {
    const startedAtMs = NOW - 60_000; // 1 minute ago
    const result = computeCycleStatus({ startedAtMs, finishedAtMs: null, action: "passed", summary: "" }, NOW);
    expect(result).toEqual({ state: "scanning", startedAtMs });
  });

  it("is scanning right at the moment a cycle starts (zero elapsed)", () => {
    const result = computeCycleStatus({ startedAtMs: NOW, finishedAtMs: null, action: "passed", summary: "" }, NOW);
    expect(result.state).toBe("scanning");
  });

  it("is idle, not scanning, once finishedAt is set — even if just now", () => {
    const startedAtMs = NOW - 30_000;
    const result = computeCycleStatus({ startedAtMs, finishedAtMs: NOW, action: "traded", summary: "Took a position." }, NOW);
    expect(result).toEqual({ state: "idle", lastStartedAtMs: startedAtMs, finishedAtMs: NOW, lastAction: "traded", lastSummary: "Took a position.", stale: false });
  });

  it("treats a finishedAt-null cycle past the stale window as a stalled attempt, not scanning forever", () => {
    const startedAtMs = NOW - 11 * 60_000; // 11 minutes ago, past the default 10-minute window
    const result = computeCycleStatus({ startedAtMs, finishedAtMs: null, action: "passed", summary: "" }, NOW);
    expect(result).toEqual({ state: "idle", lastStartedAtMs: startedAtMs, finishedAtMs: null, lastAction: "passed", lastSummary: "", stale: true });
  });

  it("is exactly at the stale boundary: still scanning at precisely staleAfterMs", () => {
    const staleAfterMs = 5 * 60_000;
    const startedAtMs = NOW - staleAfterMs;
    const result = computeCycleStatus({ startedAtMs, finishedAtMs: null, action: "passed", summary: "" }, NOW, staleAfterMs);
    expect(result.state).toBe("scanning");
  });

  it("respects a custom staleAfterMs", () => {
    const startedAtMs = NOW - 2 * 60_000;
    const result = computeCycleStatus({ startedAtMs, finishedAtMs: null, action: "passed", summary: "" }, NOW, 60_000);
    expect(result.state).toBe("idle");
  });
});
