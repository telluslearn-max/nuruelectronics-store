import "server-only";
import { addItem } from "@/lib/actions";
import type { Cart } from "@/lib/shopify/types";

export async function addToCartTool(args: { variantId: string; quantity?: number }): Promise<Cart> {
  return addItem(args.variantId, args.quantity ?? 1);
}
