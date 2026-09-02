import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { checkOrderStatus } from "@/lib/concierge/support-tool";
import { isConciergeRateLimited } from "@/lib/concierge/rate-limit";
import { getClientIp } from "@/lib/request-ip";

/**
 * POST /api/orders/status  { orderNumber, email }
 *
 * Order status by number + the email it was placed with — the same
 * identity check and the same per-IP rate limit the AI concierge's
 * `check_order_status` tool already uses (this is the WebMCP path to it).
 * Unauthenticated by design; both fields must match.
 */
export async function POST(request: Request) {
  try {
    if (await isConciergeRateLimited(getClientIp(request))) {
      return NextResponse.json({ error: "Too many requests — try again shortly." }, { status: 429 });
    }
    const body = (await request.json()) as { orderNumber?: string; email?: string };
    if (typeof body.orderNumber !== "string" || typeof body.email !== "string") {
      return NextResponse.json({ error: "orderNumber and email are required." }, { status: 400 });
    }
    return NextResponse.json(await checkOrderStatus(body.orderNumber, body.email));
  } catch (error) {
    return jsonError(500, error);
  }
}
