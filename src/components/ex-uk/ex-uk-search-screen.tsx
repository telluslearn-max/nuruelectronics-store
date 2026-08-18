"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/lib/shopify/types";
import { ExUkProductCard } from "./ex-uk-product-card";
import { ExUkProductDetail } from "./ex-uk-product-detail";
import { ExUkTopBar } from "./ex-uk-top-bar";
import { useExUkBookmark } from "./use-ex-uk-bookmark";

function SearchGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.3-4.3" />
    </svg>
  );
}

export function ExUkSearchScreen({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const { isBookmarked, toggleBookmark } = useExUkBookmark();

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return products.filter((p) => p.title.toLowerCase().includes(term));
  }, [products, query]);

  return (
    <>
      <ExUkTopBar title="Search" backHref="/ex-uk" backLabel="Discover" />

      <div className="border-b border-border-subtle p-3">
        <label className="flex items-center gap-2 rounded-control border border-border-subtle px-3.5 py-2.5">
          <SearchGlyph className="h-4 w-4 shrink-0 text-neutral-400" />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Ex-UK units…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {query.trim() === "" ? (
          <p className="pt-16 text-center text-sm text-neutral-500">Search by phone name, e.g. &ldquo;iPhone 13&rdquo;.</p>
        ) : results.length === 0 ? (
          <p className="pt-16 text-center text-sm text-neutral-500">No Ex-UK units match &ldquo;{query}&rdquo;.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {results.map((product) => (
              <div key={product.id} className="relative aspect-[3/4]">
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
                    bookmarked={isBookmarked(product.handle)}
                    onBookmark={() => toggleBookmark(product)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {detailProduct && <ExUkProductDetail product={detailProduct} onClose={() => setDetailProduct(null)} />}
    </>
  );
}
