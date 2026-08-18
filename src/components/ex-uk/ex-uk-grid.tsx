"use client";

import { useState } from "react";
import type { Savings } from "@/lib/product-match";
import type { Product } from "@/lib/shopify/types";
import { ExUkProductCard } from "./ex-uk-product-card";
import { ExUkProductDetail } from "./ex-uk-product-detail";
import { useExUkBookmark } from "./use-ex-uk-bookmark";

/**
 * Desktop counterpart to SwipeDeck — nobody drags a card with a mouse, so instead of resizing the
 * phone swipe deck this is a genuine browse grid: every unit stays visible (no "pass" that removes
 * it, since revisiting anytime is the point of a grid), a hover/tap bookmark saves to the wishlist
 * inline, and clicking a card opens the same ExUkProductDetail overlay the mobile deck uses for
 * full specs and Add to Cart/Buy Now. Rendered alongside SwipeDeck with a `sm:` CSS swap (see
 * ex-uk-discover-screen.tsx) rather than a JS viewport check, so there's no hydration flash.
 */
export function ExUkGrid({
  products,
  savingsByHandle,
  isFiltered,
  onClearFilters,
}: {
  products: Product[];
  savingsByHandle: Record<string, Savings>;
  isFiltered: boolean;
  onClearFilters?: () => void;
}) {
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const { isBookmarked, toggleBookmark } = useExUkBookmark();

  if (products.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-16 text-center">
        <p className="text-base font-medium">
          {isFiltered ? "No units match your filters" : "No Ex-UK units right now"}
        </p>
        <p className="text-sm text-neutral-500">
          {isFiltered ? "Try a different category or brand." : "Check back soon for new stock."}
        </p>
        {isFiltered && onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-2 rounded-control border border-border-subtle px-4 py-2 text-sm font-medium transition hover:border-foreground"
          >
            Clear filters
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="grid flex-1 grid-cols-2 gap-4 overflow-y-auto p-4 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <div key={product.id} className="relative aspect-[3/4]">
            {/* Same role="group" (not "button") as SwipeCard for the same reason: ExUkProductCard
                has its own nested bookmark button that already stopPropagates for the
                swipe-card drag-catcher use case — a real <button>, or role="button", shouldn't
                contain other focusable descendants. */}
            <div
              role="group"
              tabIndex={0}
              aria-label={`View details for ${product.title}`}
              onClick={() => setDetailProduct(product)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setDetailProduct(product);
                }
              }}
              className="h-full w-full cursor-pointer"
            >
              <ExUkProductCard
                product={product}
                savings={savingsByHandle[product.handle]}
                bookmarked={isBookmarked(product.handle)}
                onBookmark={() => toggleBookmark(product)}
              />
            </div>
          </div>
        ))}
      </div>

      {detailProduct && (
        <ExUkProductDetail
          product={detailProduct}
          savings={savingsByHandle[detailProduct.handle]}
          onClose={() => setDetailProduct(null)}
        />
      )}
    </>
  );
}
