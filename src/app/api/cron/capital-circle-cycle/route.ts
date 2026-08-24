import { NextResponse } from "next/server";
import { runCapitalCircleCycle } from "@/lib/capital-circle/agent-loop";
import { settleResolvedPositions } from "@/lib/capital-circle/settlement";
import { sendCapitalCircleCycleEmail } from "@/lib/email";
import { constantTimeEqual } from "@/lib/admin-session-token";
import { prisma } from "@/lib/prisma";

/**
 * Was missing entirely — every other route in this codebase that calls Gemini more than once
 * declares one explicitly (see concierge/chat and concierge/voice-turn, both maxDuration=60), but
 * this route runs a *multi-stage* pipeline (a grounding call, then an ENSEMBLE_SAMPLES-way scoring
 * call producing up to SCORING_MAX_OUTPUT_TOKENS of JSON, then a deep-dive tool-calling loop up to
 * MAX_TOOL_ITERATIONS rounds) that can plausibly run well past a platform default. Set to 300 to
 * match runCycleWithLock's own transaction `timeout: 300_000` below — that number already encodes
 * the author's own expectation of how long a cycle can legitimately take; the route just never
 * had a matching ceiling of its own, so on a plan/config where the default is lower, every
 * invocation may have been silently killed by the platform before ever writing a cycle log.
 */
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return constantTimeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`);
}

// Arbitrary fixed key for this job's Postgres advisory lock — just needs to be unique among any
// other advisory locks this app might ever take. Plain number, not BigInt: well within
// Number.MAX_SAFE_INTEGER, and the project's ES2017 target doesn't support BigInt literals.
const CYCLE_LOCK_KEY = 917_263_540_501;

/**
 * Vercel Cron and GCP Cloud Scheduler both hit this route hourly as redundant triggers, and
 * either can retry a slow invocation — without a lock, two overlapping runs could each place
 * trades against the same cap window before either one's spend is visible to the other. Skips
 * (rather than queues) when another run already holds the lock: an overlapping cycle is
 * redundant, not backlogged work to get to later.
 *
 * pg_try_advisory_lock/pg_advisory_unlock are tied to the Postgres session that acquired them,
 * so both calls must run on the same connection — a $transaction is the only way Prisma
 * guarantees that against a pooled connection, hence the generous timeout (the wrapped cycle
 * calls Vertex AI and external market APIs, which can run well past Prisma's 5s default).
 */
async function runCycleWithLock(): Promise<Awaited<ReturnType<typeof runCapitalCircleCycle>> | { ran: false; error: string }> {
  return prisma.$transaction(
    async (tx) => {
      const [row] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_lock(${CYCLE_LOCK_KEY}) AS locked`;
      if (!row?.locked) {
        return { ran: false, error: "Another capital-circle-cycle run is already in progress." };
      }
      try {
        return await runCapitalCircleCycle();
      } finally {
        await tx.$queryRaw`SELECT pg_advisory_unlock(${CYCLE_LOCK_KEY})`;
      }
    },
    { timeout: 300_000, maxWait: 10_000 },
  );
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });

  // Independent of the research/trading cycle below — a settlement lookup failure (a flaky
  // Gamma API call, say) must never block this hour's trade, and vice versa. No advisory lock:
  // each row only ever moves from resolvedAt=null to set once, so an overlapping run is at worst
  // redundant, never corrupting.
  try {
    const settlement = await settleResolvedPositions();
    console.log("[cron:capital-circle-cycle] settlement", settlement);
  } catch (error) {
    console.error("[cron:capital-circle-cycle] settlement failed:", error);
  }

  try {
    const result = await runCycleWithLock();
    console.log("[cron:capital-circle-cycle]", result);
    // Only for cycles that actually ran — an unconfigured Capital Circle staying unconfigured
    // isn't news worth a weekly email, but every real outcome (including "no trade") is.
    if (result.ran) {
      await sendCapitalCircleCycleEmail(result);
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("[cron:capital-circle-cycle] failed:", error);
    return NextResponse.json({ ran: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
