import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { addItems, getCart, markCartConciergeAssisted } from "@/lib/actions";
import { logAdminAction } from "@/lib/audit-log";
import { isCheckoutUsable } from "@/lib/checkout";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { buildWhatsAppHandoffMessage } from "@/lib/concierge/whatsapp-tool";

/**
 * POST /api/cart/checkout  { items?: [{ variantId, quantity }] }
 *
 * The WebMCP `create_order` path: optionally add the given items, then hand
 * back a checkout URL for the shopper to complete themselves. **Nothing is
 * charged here** — this only assembles the cart and returns the link, matching
 * the concierge's own checkout boundary. Where Shopify checkout isn't usable
 * (mock/unconfigured), returns a WhatsApp order link instead of a dead URL.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      items?: { variantId?: unknown; quantity?: unknown }[];
    };

    const items = Array.isArray(body.items)
      ? body.items
          .map((i) => ({
            variantId: typeof i.variantId === "string" ? i.variantId : "",
            quantity: typeof i.quantity === "number" && i.quantity > 0 ? Math.floor(i.quantity) : 1,
          }))
          .filter((i) => i.variantId)
      : [];

    if (items.length > 0) await addItems(items);

    const cart = await getCart();
    if (!cart || cart.lines.length === 0) {
      return NextResponse.json({ error: "Cart is empty — add items before checkout." }, { status: 422 });
    }

    void markCartConciergeAssisted().catch((error) => console.error("markCartConciergeAssisted failed", error));
    void logAdminAction({
      action: "webmcp.create_order",
      entityType: "cart",
      entityId: cart.id,
      summary: "WebMCP agent assembled a cart and requested checkout",
      metadata: { lineCount: cart.lines.length },
    }).catch((error) => console.error("logAdminAction failed", error));

    if (isCheckoutUsable(cart.checkoutUrl)) {
      return NextResponse.json({
        ok: true,
        checkoutUrl: cart.checkoutUrl,
        totalQuantity: cart.totalQuantity,
        totalAmount: cart.cost.totalAmount,
      });
    }

    const message = buildWhatsAppHandoffMessage({ summary: "I'd like to place this order.", cart });
    return NextResponse.json({
      ok: true,
      checkoutUnavailable: true,
      whatsappUrl: buildWhatsAppUrl(message),
      totalQuantity: cart.totalQuantity,
      totalAmount: cart.cost.totalAmount,
    });
  } catch (error) {
    return jsonError(500, error);
  }
}
