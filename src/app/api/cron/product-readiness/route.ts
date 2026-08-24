import { NextResponse } from "next/server";
import { getProductReadinessViolations } from "@/lib/shopify/admin-api";
import { sendProductReadinessEmail } from "@/lib/email";
import { constantTimeEqual } from "@/lib/admin-session-token";
import { jsonError } from "@/lib/api-response";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return constantTimeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`);
}

async function run() {
  // Active products only — drafts are expected to be unfinished, so checking them
  // daily would just be noise until #56 (finish-vs-abandon policy) is decided.
  const result = await getProductReadinessViolations({ includeDrafts: false });
  console.log("[cron:product-readiness]", { checked: result.checked, violations: result.violations.length });
  await sendProductReadinessEmail(result.checked, result.violations);
  return result;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  try {
    return NextResponse.json(await run());
  } catch (error) {
    console.error("[cron:product-readiness] failed:", error);
    return jsonError(500, error);
  }
}

export async function POST(request: Request) {
  return GET(request);
}
