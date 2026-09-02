import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { addItem, markCartConciergeAssisted } from "@/lib/actions";
import { logAdminAction } from "@/lib/audit-log";

/**
 * POST /api/cart/add  { variantId, quantity? }
 *
 * The WebMCP path to the storefront cart — same cookie-based cart the site
 * itself uses. Returns the new totals and a line id. The agent still hands the
 * shopper a checkout URL (see /api/cart/checkout); nothing is charged here.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { variantId?: string; quantity?: number };
    const variantId = typeof body.variantId === "string" ? body.variantId : "";
    const quantity = typeof body.quantity === "number" && body.quantity > 0 ? Math.floor(body.quantity) : 1;
    if (!variantId) {
      return NextResponse.json({ error: "variantId is required." }, { status: 400 });
    }

    const cart = await addItem(variantId, quantity);
    void markCartConciergeAssisted().catch((error) => console.error("markCartConciergeAssisted failed", error));
    void logAdminAction({
      action: "webmcp.add_to_cart",
      entityType: "cart",
      entityId: cart.id,
      summary: `WebMCP agent added variant ${variantId} (qty ${quantity}) to cart`,
      metadata: { variantId, quantity },
    }).catch((error) => console.error("logAdminAction failed", error));

    const line = cart.lines.find((l) => l.merchandise.id === variantId);
    return NextResponse.json({
      ok: true,
      lineId: line?.id ?? null,
      totalQuantity: cart.totalQuantity,
      totalAmount: cart.cost.totalAmount,
    });
  } catch (error) {
    return jsonError(500, error);
  }
}
