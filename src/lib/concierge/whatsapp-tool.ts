import { SITE_URL } from "@/lib/site";
import type { Cart } from "@/lib/shopify/types";

export const isWhatsAppHandoffConfigured = Boolean(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER);

/** Mirrors the message/URL construction in whatsapp-order-button.tsx, but summarizes the conversation/cart rather than one product. */
export function buildWhatsAppHandoffMessage(args: { summary: string; cart?: Cart | null }): string {
  const { summary, cart } = args;
  const lines = [summary.trim() || "Hi! I'd like some help with an order.", "", SITE_URL];

  if (cart && cart.lines.length > 0) {
    lines.push("", "Cart:");
    for (const line of cart.lines) {
      const variantLabel = line.merchandise.title !== "Default Title" ? ` (${line.merchandise.title})` : "";
      lines.push(`- ${line.merchandise.product.title}${variantLabel} x${line.quantity}`);
    }
    lines.push(`Total: ${cart.cost.totalAmount.currencyCode} ${cart.cost.totalAmount.amount}`);
  }

  return lines.join("\n");
}
