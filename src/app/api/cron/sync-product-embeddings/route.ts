import { NextResponse } from "next/server";
import { isConciergeConfigured } from "@/lib/concierge/embeddings";
import { syncProductEmbeddings } from "@/lib/search/semantic-search";
import { constantTimeEqual } from "@/lib/admin-session-token";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return constantTimeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`);
}

async function run() {
  if (!isConciergeConfigured) {
    const result = { synced: false, reason: "Vertex AI not configured" };
    console.log("[cron:sync-product-embeddings]", result);
    return result;
  }
  const result = { synced: true, ...(await syncProductEmbeddings()) };
  console.log("[cron:sync-product-embeddings]", result);
  return result;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  try {
    return NextResponse.json(await run());
  } catch (error) {
    console.error("[cron:sync-product-embeddings] failed:", error);
    return NextResponse.json({ synced: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
