import { NextResponse } from "next/server";

/**
 * Standardizes how a route builds its JSON error response, without standardizing the response
 * *shape* itself — each caller keeps its own extra context fields (e.g. `{ synced: false }`,
 * `{ checked: 0, settled: 0 }`) exactly as before, passed through `extra`. This only centralizes
 * the one thing that was genuinely duplicated: turning a caught error into an `error: string`
 * message the same way everywhere, following A Philosophy of Software Design's Ch. 10 guidance
 * to aggregate exception-handling boilerplate rather than reinvent it per call site.
 *
 * Deliberately additive, not a replacement envelope: it's unverified whether anything (Vercel's
 * cron dashboard, alerting) parses these response bodies, so no route's existing keys are
 * dropped or renamed by adopting this.
 */
export function jsonError(status: number, error: unknown, extra?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return NextResponse.json({ ...extra, error: message }, { status });
}
