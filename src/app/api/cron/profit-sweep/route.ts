import { NextResponse } from "next/server";
import { recordPendingSweep, weekStartOf } from "@/lib/capital-circle/sweep";
import { sendSweepReadyEmail } from "@/lib/email";
import { constantTimeEqual } from "@/lib/admin-session-token";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return constantTimeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`);
}

async function runSweep() {
  // The cron fires Monday morning for the week that just ended — subtract 7
  // days from "this" Monday to land on last week's start, not this week's.
  const thisWeekStart = weekStartOf(new Date());
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 7);

  const sweep = await recordPendingSweep(lastWeekStart);
  await sendSweepReadyEmail(sweep);

  return {
    weekStart: sweep.weekStart,
    totalProfitUsd: Number(sweep.totalProfitUsd),
    sweepAmountUsd: Number(sweep.sweepAmountUsd),
    status: sweep.status,
  };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  try {
    const result = await runSweep();
    console.log("[cron:profit-sweep]", result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[cron:profit-sweep] failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
