import "server-only";
import { addItem, removeItem, updateItemQuantity } from "@/lib/actions";
import type { Cart } from "@/lib/shopify/types";

export async function addToCartTool(args: { variantId: string; quantity?: number }): Promise<Cart> {
  return addItem(args.variantId, args.quantity ?? 1);
}

export async function removeCartItem(lineId: string): Promise<Cart> {
  return removeItem(lineId);
}

export async function updateCartItemQuantity(lineId: string, quantity: number): Promise<Cart> {
  return updateItemQuantity(lineId, quantity);
}
