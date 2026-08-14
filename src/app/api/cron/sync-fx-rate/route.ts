import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { constantTimeEqual } from "@/lib/admin-session-token";

const SETTINGS_ID = "settings";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return constantTimeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`);
}

// exchangerate-api.com's keyed endpoint — free tier, but needs an API key (FX_RATE_API_KEY) for
// reasonable rate limits/reliability, unlike their unauthenticated open.er-api.com mirror.
async function fetchUsdToKesRate(): Promise<number> {
  const apiKey = process.env.FX_RATE_API_KEY;
  if (!apiKey) throw new Error("FX_RATE_API_KEY isn't set.");

  const res = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok || json.result !== "success") {
    throw new Error(`FX rate fetch failed: ${json["error-type"] ?? res.statusText}`);
  }
  const rate = json.conversion_rates?.KES;
  if (typeof rate !== "number") throw new Error("FX rate response had no KES rate.");
  return rate;
}

async function runSync() {
  const rate = await fetchUsdToKesRate();
  await prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, usdToKesRate: rate.toFixed(4), usdToKesRateUpdatedAt: new Date() },
    update: { usdToKesRate: rate.toFixed(4), usdToKesRateUpdatedAt: new Date() },
  });
  const result = { synced: true, usdToKesRate: rate };
  console.log("[cron:sync-fx-rate]", result);
  return result;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  try {
    return NextResponse.json(await runSync());
  } catch (error) {
    console.error("[cron:sync-fx-rate] failed:", error);
    return NextResponse.json({ synced: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
