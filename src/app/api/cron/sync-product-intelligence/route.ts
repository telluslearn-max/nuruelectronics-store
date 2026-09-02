import { NextResponse } from "next/server";
import { syncProductIntelligence } from "@/lib/intelligence/ingest/sync";
import { constantTimeEqual } from "@/lib/admin-session-token";

/**
 * Nightly product-intelligence sync — see src/lib/intelligence/ingest/sync.ts.
 * Runs 30 minutes after sync-product-embeddings (vercel.json) so both nightly
 * catalog walks don't overlap.
 */

/** The catalog walk + a few grounded-search passes can run long; give it the platform max. */
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return constantTimeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`);
}

async function run() {
  const result = await syncProductIntelligence();
  console.log("[cron:sync-product-intelligence]", result);
  return result;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  try {
    return NextResponse.json(await run());
  } catch (error) {
    console.error("[cron:sync-product-intelligence] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
