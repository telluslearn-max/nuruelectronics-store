"use client";

import { useWishlist } from "@/components/wishlist/wishlist-context";
import type { Product } from "@/lib/shopify/types";
import { useExUkMatches } from "./use-ex-uk-matches";

/**
 * Shared bookmark behavior for the card's corner badge (ExUkGrid, SwipeCard, ExUkProductDetail,
 * ExUkSearchScreen) — saves to the real site-wide wishlist (not a separate Ex-UK list), and on
 * the save (not un-save) direction also ensures a match exists so the WhatsApp-style concierge
 * inbox always has a thread to open for anything a shopper bookmarked. Kept as one hook instead
 * of repeating this pairing at each call site.
 */
export function useExUkBookmark() {
  const { isSaved, toggleWishlist } = useWishlist();
  const { addMatch } = useExUkMatches();

  function isBookmarked(handle: string) {
    return isSaved(handle);
  }

  function toggleBookmark(product: Product) {
    const wasSaved = isSaved(product.handle);
    toggleWishlist({ handle: product.handle, title: product.title, image: product.images[0]?.url });
    if (!wasSaved) {
      addMatch({ handle: product.handle, title: product.title, imageUrl: product.images[0]?.url ?? null });
    }
  }

  return { isBookmarked, toggleBookmark };
}
