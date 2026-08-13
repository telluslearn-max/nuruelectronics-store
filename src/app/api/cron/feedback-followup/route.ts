import { NextResponse } from "next/server";
import { constantTimeEqual } from "@/lib/admin-session-token";
import { sendFeedbackFollowupEmail } from "@/lib/email";
import { buildFeedbackToken } from "@/lib/feedback-token";
import { prisma } from "@/lib/prisma";

const FEEDBACK_DELAY_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return constantTimeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function runFeedbackFollowup() {
  // Orders created on the UTC calendar day that is exactly FEEDBACK_DELAY_DAYS before today — a
  // full-day bucket, not a millisecond-precise one, so this is robust to what time of day the cron
  // actually runs (and, for manual testing, what time of day a test order got backdated) while
  // still hitting each order's bucket exactly once as the daily cron rolls forward one day at a
  // time — no throttle field needed (unlike invoice reminders, which repeat until paid, this is a
  // one-shot nudge).
  const targetDayStart = new Date(startOfUtcDay(new Date()).getTime() - FEEDBACK_DELAY_DAYS * MS_PER_DAY);
  const targetDayEnd = new Date(targetDayStart.getTime() + MS_PER_DAY);

  const candidates = await prisma.order.findMany({
    where: { createdAt: { gte: targetDayStart, lt: targetDayEnd }, feedback: { none: {} } },
    include: { customer: true },
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const order of candidates) {
    try {
      if (!order.customer?.email) {
        skipped++;
        continue;
      }
      const token = buildFeedbackToken(order.id, order.customerId);
      await sendFeedbackFollowupEmail(order, order.customer, token);
      sent++;
    } catch (error) {
      console.error(`[cron:feedback-followup] Failed to send follow-up for order ${order.id}:`, error);
      failed++;
    }
  }

  const result = { candidates: candidates.length, sent, failed, skipped };
  console.log("[cron:feedback-followup]", result);
  return result;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  try {
    return NextResponse.json(await runFeedbackFollowup());
  } catch (error) {
    console.error("[cron:feedback-followup] failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
