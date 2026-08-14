import { NextResponse } from "next/server";
import { runCapitalCircleCycle } from "@/lib/capital-circle/agent-loop";
import { constantTimeEqual } from "@/lib/admin-session-token";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return constantTimeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  try {
    const result = await runCapitalCircleCycle();
    console.log("[cron:capital-circle-cycle]", result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[cron:capital-circle-cycle] failed:", error);
    return NextResponse.json({ ran: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
