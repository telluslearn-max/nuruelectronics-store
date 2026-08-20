import { NextResponse } from "next/server";
import { settleResolvedPositions } from "@/lib/capital-circle/settlement";
import { manageOpenPositions } from "@/lib/capital-circle/position-manager";
import { constantTimeEqual } from "@/lib/admin-session-token";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return constantTimeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`);
}

/**
 * Settlement's own cron, separate from capital-circle-cycle's hourly research/trading run — that
 * one only checks for resolved markets as a side effect of its hourly tick, so a market that
 * closes minutes after a tick could sit unscored for up to an hour. This route does nothing but
 * settlement (no Gemini call, no trading), so it's cheap enough to run every minute — see
 * README.md for the Cloud Scheduler command. capital-circle-cycle still runs its own settlement
 * pass too; that's intentional redundancy, not a race — each position only ever moves from
 * resolvedAt=null to set once, so two schedulers checking the same position is harmless.
 *
 * Also runs position management (take-profit and stop-loss). That belongs on this cadence
 * rather than the hourly cycle for the same reason settlement does: an exit trigger that goes
 * unnoticed for fifty minutes is an exit that didn't happen at the price it was triggered at.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  try {
    // Exits first: a position that should already have been closed shouldn't be settled at
    // resolution as though it had been held deliberately.
    const managed = await manageOpenPositions().catch((error) => {
      console.error("[cron:capital-circle-settle] position management failed:", error);
      return { checked: 0, exited: 0 };
    });
    const result = await settleResolvedPositions();
    console.log("[cron:capital-circle-settle]", { ...result, ...managed });
    return NextResponse.json({ ...result, managed });
  } catch (error) {
    console.error("[cron:capital-circle-settle] failed:", error);
    return NextResponse.json({ checked: 0, settled: 0, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
