import { NextResponse } from "next/server";
import { isConciergeConfigured } from "@/lib/concierge/embeddings";
import { syncProductEmbeddings } from "@/lib/search/semantic-search";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function run() {
  if (!isConciergeConfigured) {
    return { synced: false, reason: "Vertex AI not configured" };
  }
  const result = await syncProductEmbeddings();
  return { synced: true, ...result };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  const result = await run();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  const result = await run();
  return NextResponse.json(result);
}
