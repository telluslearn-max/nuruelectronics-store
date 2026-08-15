"use client";

import { useState } from "react";
import type { Savings } from "@/lib/product-match";
import type { Product } from "@/lib/shopify/types";
import { HeartIcon } from "./action-icons";
import { ExUkProductCard } from "./ex-uk-product-card";
import { ExUkProductDetail } from "./ex-uk-product-detail";
import { useExUkMatches } from "./use-ex-uk-matches";

/**
 * Desktop counterpart to SwipeDeck — nobody drags a card with a mouse, so instead of resizing the
 * phone swipe deck this is a genuine browse grid: every unit stays visible (no "pass" that removes
 * it, since revisiting anytime is the point of a grid), a hover/tap heart toggles a match inline,
 * and clicking a card opens the same ExUkProductDetail overlay the mobile deck uses for full specs
 * and the WhatsApp order button. Rendered alongside SwipeDeck with a `sm:` CSS swap (see
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
  const { matches, addMatch, removeMatch } = useExUkMatches();
  const matchedHandles = new Set(matches.map((m) => m.handle));

  function toggleMatch(product: Product) {
    if (matchedHandles.has(product.handle)) {
      removeMatch(product.handle);
    } else {
      addMatch({ handle: product.handle, title: product.title, imageUrl: product.images[0]?.url ?? null });
    }
  }

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
        {products.map((product) => {
          const isMatched = matchedHandles.has(product.handle);
          return (
            <div key={product.id} className="relative aspect-[3/4]">
              {/* Same role="group" (not "button") as SwipeCard for the same reason: ExUkProductCard
                  has its own nested buttons (photo dots, "More info") that already stopPropagation
                  for the swipe-card drag-catcher use case — a real <button>, or role="button",
                  shouldn't contain other focusable descendants. */}
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
                <ExUkProductCard product={product} savings={savingsByHandle[product.handle]} />
              </div>
              <button
                type="button"
                onClick={() => toggleMatch(product)}
                aria-pressed={isMatched}
                aria-label={isMatched ? `Remove ${product.title} from matches` : `Save ${product.title} to matches`}
                className={`absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full shadow-sm transition ${
                  isMatched ? "bg-accent text-accent-foreground" : "bg-black/40 text-white hover:bg-black/60"
                }`}
              >
                <HeartIcon className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      {detailProduct && (
        <ExUkProductDetail
          product={detailProduct}
          savings={savingsByHandle[detailProduct.handle]}
          onClose={() => setDetailProduct(null)}
          onSwipe={(direction) => {
            if (direction === "right") {
              addMatch({
                handle: detailProduct.handle,
                title: detailProduct.title,
                imageUrl: detailProduct.images[0]?.url ?? null,
              });
            }
            setDetailProduct(null);
          }}
        />
      )}
    </>
  );
}
