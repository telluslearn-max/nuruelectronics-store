import { NextResponse } from "next/server";
import { computePnl } from "@/lib/reports/pnl";
import { isGoogleSheetsConfigured, writePnlToSheet } from "@/lib/google-sheets";
import { postMonthlyDepreciation } from "@/lib/depreciation";
import { constantTimeEqual } from "@/lib/admin-session-token";
import { jsonError } from "@/lib/api-response";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return constantTimeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`);
}

async function runSync() {
  const depreciation = await postMonthlyDepreciation();

  if (!isGoogleSheetsConfigured) {
    const result = { synced: false, reason: "Google Sheets not configured", depreciationPosted: depreciation.posted };
    console.log("[cron:sync-pnl]", result);
    return result;
  }

  const now = new Date();
  const from = new Date(now.getFullYear(), 0, 1);
  const to = new Date(now.getFullYear() + 1, 0, 1);
  const pnl = await computePnl({ from, to, granularity: "monthly" });
  await writePnlToSheet(pnl);

  const result = { synced: true, buckets: pnl.buckets, depreciationPosted: depreciation.posted };
  console.log("[cron:sync-pnl] synced", result.buckets.length, "buckets, depreciationPosted:", result.depreciationPosted);
  return result;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  try {
    return NextResponse.json(await runSync());
  } catch (error) {
    console.error("[cron:sync-pnl] failed:", error);
    return jsonError(500, error, { synced: false });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
