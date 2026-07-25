"use client";

import { useEffect, useState } from "react";
import { getProductsByHandles } from "@/lib/actions";
import type { Product } from "@/lib/shopify/types";

/**
 * Fetches products for `handles`, guarding against the stuck-loading class of bug fixed in
 * 06e5e9d: a cancelled-flag guards against a stale response overwriting a newer one, and a
 * rejected fetch resolves to an empty list (surfaced via the caller's own empty state) rather
 * than leaving the section stuck on "loading" forever. This was previously copy-pasted
 * near-identically into recently-viewed-carousel.tsx and wishlist-section.tsx — extracted here so
 * a future call site can't drift from the fix the same way search-box.tsx's separate debounce
 * fetch did (see that file for its own equivalent guard).
 */
export function useHandleProducts(handles: string[]): Product[] | undefined {
  const [products, setProducts] = useState<Product[] | undefined>(handles.length === 0 ? [] : undefined);
  // Callers often pass a freshly-mapped array each render (e.g. `items.map(i => i.handle)`) — key
  // the effect off its content, not its reference, so this doesn't refetch on every render.
  const handlesKey = handles.join(",");

  useEffect(() => {
    if (handles.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProducts([]);
      return;
    }
    let cancelled = false;
    getProductsByHandles(handles)
      .then((fetched) => {
        if (!cancelled) setProducts(fetched);
      })
      .catch((error) => {
        console.error("Failed to load products:", error);
        if (!cancelled) setProducts([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on handlesKey (content), not handles (reference)
  }, [handlesKey]);

  return products;
}
