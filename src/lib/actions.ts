"use server";

import { cookies } from "next/headers";
import {
  addToCart as addToCartInShopify,
  createCart,
  getCart as getCartFromShopify,
  getProductByHandle,
  getProducts,
  removeFromCart as removeFromCartInShopify,
  updateCartAttributes as updateCartAttributesInShopify,
  updateCartLine as updateCartLineInShopify,
} from "./shopify";
import type { ProductsPage } from "./shopify";
import type { Cart, Product } from "./shopify/types";

const CART_COOKIE = "cartId";

async function getValidCartId(): Promise<string | null> {
  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_COOKIE)?.value;
  if (!cartId) return null;
  try {
    const existing = await getCartFromShopify(cartId);
    return existing ? cartId : null;
  } catch {
    // Malformed or expired cart id (e.g. left over from switching data sources) - treat as no cart.
    return null;
  }
}

async function getOrCreateCartId(): Promise<string> {
  const existing = await getValidCartId();
  if (existing) return existing;
  const cart = await createCart();
  const cookieStore = await cookies();
  cookieStore.set(CART_COOKIE, cart.id, { httpOnly: true, sameSite: "lax" });
  return cart.id;
}

export async function getCart(): Promise<Cart | null> {
  const cartId = await getValidCartId();
  if (!cartId) return null;
  return getCartFromShopify(cartId);
}

export async function addItem(variantId: string, quantity: number = 1): Promise<Cart> {
  const cartId = await getOrCreateCartId();
  return addToCartInShopify(cartId, [{ merchandiseId: variantId, quantity }]);
}

export async function addItems(lines: { variantId: string; quantity: number }[]): Promise<Cart> {
  const cartId = await getOrCreateCartId();
  return addToCartInShopify(
    cartId,
    lines.map((line) => ({ merchandiseId: line.variantId, quantity: line.quantity })),
  );
}

export async function updateItemQuantity(lineId: string, quantity: number): Promise<Cart> {
  const cartId = await getOrCreateCartId();
  if (quantity <= 0) {
    return removeFromCartInShopify(cartId, lineId);
  }
  return updateCartLineInShopify(cartId, lineId, quantity);
}

export async function removeItem(lineId: string): Promise<Cart> {
  const cartId = await getOrCreateCartId();
  return removeFromCartInShopify(cartId, lineId);
}

/** Tags the current session's cart as AI-concierge-assisted, so completed orders carry it through to the AI-attribution report. */
export async function markCartConciergeAssisted(): Promise<void> {
  const cartId = await getOrCreateCartId();
  await updateCartAttributesInShopify(cartId, [{ key: "concierge_assisted", value: "true" }]);
}

export type SearchSuggestion = {
  handle: string;
  title: string;
  productType: string;
  price: { amount: string; currencyCode: string };
};

export async function searchSuggestions(term: string): Promise<SearchSuggestion[]> {
  const trimmed = term.trim();
  if (trimmed.length < 2) return [];
  const { products } = await getProducts({ searchTerm: trimmed, first: 5 });
  return products.map((p) => ({
    handle: p.handle,
    title: p.title,
    productType: p.productType,
    price: p.priceRange.minVariantPrice,
  }));
}

/** allSettled, not all — one failing handle lookup (stale/deleted product, transient error) shouldn't drop the whole batch for callers like recently-viewed/wishlist/for-you rails. */
export async function getProductsByHandles(handles: string[]): Promise<Product[]> {
  const results = await Promise.allSettled(handles.map((handle) => getProductByHandle(handle)));
  return results
    .filter((r): r is PromiseFulfilledResult<Product | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((p): p is Product => p !== null);
}

export async function loadMoreProducts(
  cursor: string,
  searchTerm?: string,
  sort?: { sortKey: "PRICE" | "BEST_SELLING" | "CREATED_AT"; reverse: boolean },
): Promise<ProductsPage> {
  return getProducts({ after: cursor, searchTerm, sortKey: sort?.sortKey, reverse: sort?.reverse });
}
