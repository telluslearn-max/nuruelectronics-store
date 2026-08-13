"use server";

import { cookies } from "next/headers";
import {
  addToCart as addToCartInShopify,
  createCart,
  getCart as getCartFromShopify,
  getProductByHandle,
  getProducts,
  removeFromCart as removeFromCartInShopify,
  sanitizeFreeTextSearchTerm,
  updateCartAttributes as updateCartAttributesInShopify,
  updateCartLine as updateCartLineInShopify,
} from "./shopify";
import type { ProductsPage } from "./shopify";
import type { Cart, Product } from "./shopify/types";
import { getSessionId, SESSION_CART_ATTRIBUTE_KEY } from "./session";

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
  const cart = await replaceCart();
  return cart.id;
}

/** Creates a fresh cart and points the cookie at it. Used both for the "no cart yet" case and to
 * recover from a stale cart id whose Shopify-side cart can no longer be mutated (e.g. its
 * checkout already completed) — `getValidCartId` can't detect that case up front since Shopify
 * still returns the cart on a plain read; it only surfaces as a mutation failure. */
async function replaceCart(): Promise<Cart> {
  const cart = await createCart();
  const cookieStore = await cookies();
  cookieStore.set(CART_COOKIE, cart.id, { httpOnly: true, sameSite: "lax" });
  return cart;
}

export async function getCart(): Promise<Cart | null> {
  const cartId = await getValidCartId();
  if (!cartId) return null;
  const cart = await getCartFromShopify(cartId);
  if (cart) {
    // Fire-and-forget — tags the cart with this browser's session id so a later checkout
    // completion can backfill this session's Interaction rows onto the resulting Order's customer
    // (see importShopifyOrder in src/lib/admin-actions.ts). Short-circuits to a cheap array check
    // once tagged, so this only costs a real Shopify write the first time per cart.
    void attachSessionAttribute(cart).catch((error) => console.error("Failed to tag cart with session id:", error));
  }
  return cart;
}

async function attachSessionAttribute(cart: Cart): Promise<void> {
  const sessionId = await getSessionId();
  if (!sessionId) return;
  if (cart.attributes.some((a) => a.key === SESSION_CART_ATTRIBUTE_KEY && a.value === sessionId)) return;
  const merged = [
    ...cart.attributes.filter((a) => a.key !== SESSION_CART_ATTRIBUTE_KEY),
    { key: SESSION_CART_ATTRIBUTE_KEY, value: sessionId },
  ];
  await updateCartAttributesInShopify(cart.id, merged);
}

export async function addItem(variantId: string, quantity: number = 1): Promise<Cart> {
  const cartId = await getOrCreateCartId();
  try {
    return await addToCartInShopify(cartId, [{ merchandiseId: variantId, quantity }]);
  } catch {
    const freshCart = await replaceCart();
    return addToCartInShopify(freshCart.id, [{ merchandiseId: variantId, quantity }]);
  }
}

export async function addItems(lines: { variantId: string; quantity: number }[]): Promise<Cart> {
  const cartId = await getOrCreateCartId();
  const shopifyLines = lines.map((line) => ({ merchandiseId: line.variantId, quantity: line.quantity }));
  try {
    return await addToCartInShopify(cartId, shopifyLines);
  } catch {
    const freshCart = await replaceCart();
    return addToCartInShopify(freshCart.id, shopifyLines);
  }
}

export async function updateItemQuantity(lineId: string, quantity: number): Promise<Cart> {
  const cartId = await getOrCreateCartId();
  try {
    if (quantity <= 0) {
      return await removeFromCartInShopify(cartId, lineId);
    }
    return await updateCartLineInShopify(cartId, lineId, quantity);
  } catch {
    // The line being updated belongs to a cart Shopify rejected (e.g. already checked out) — it
    // has no counterpart to retry against, so recover onto a fresh, empty cart instead.
    return replaceCart();
  }
}

export async function removeItem(lineId: string): Promise<Cart> {
  const cartId = await getOrCreateCartId();
  try {
    return await removeFromCartInShopify(cartId, lineId);
  } catch {
    return replaceCart();
  }
}

/** Tags the current session's cart as AI-concierge-assisted, so completed orders carry it through to the AI-attribution report. */
export async function markCartConciergeAssisted(): Promise<void> {
  const cartId = await getOrCreateCartId();
  // cartAttributesUpdate replaces the full attributes list, so merge with whatever's already there
  // (e.g. the nuru_session_id tag set by getCart's attachSessionAttribute) instead of clobbering it.
  const cart = await getCartFromShopify(cartId);
  const merged = [...(cart?.attributes.filter((a) => a.key !== "concierge_assisted") ?? []), { key: "concierge_assisted", value: "true" }];
  await updateCartAttributesInShopify(cartId, merged);
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
  const { products } = await getProducts({ searchTerm: sanitizeFreeTextSearchTerm(trimmed), first: 5 });
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
