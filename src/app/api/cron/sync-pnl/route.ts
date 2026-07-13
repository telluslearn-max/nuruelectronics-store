import { NextResponse } from "next/server";
import { computePnl } from "@/lib/reports/pnl";
import { isGoogleSheetsConfigured, writePnlToSheet } from "@/lib/google-sheets";
import { postMonthlyDepreciation } from "@/lib/depreciation";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function runSync() {
  const depreciation = await postMonthlyDepreciation();

  if (!isGoogleSheetsConfigured) {
    return { synced: false, reason: "Google Sheets not configured", depreciationPosted: depreciation.posted };
  }

  const now = new Date();
  const from = new Date(now.getFullYear(), 0, 1);
  const to = new Date(now.getFullYear() + 1, 0, 1);
  const pnl = await computePnl({ from, to, granularity: "monthly" });
  await writePnlToSheet(pnl);

  return { synced: true, buckets: pnl.buckets, depreciationPosted: depreciation.posted };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  const result = await runSync();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  const result = await runSync();
  return NextResponse.json(result);
}
