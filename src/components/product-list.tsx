"use client";

import { useMemo, useState, useTransition } from "react";
import { loadMoreProducts } from "@/lib/actions";
import type { Product } from "@/lib/shopify/types";
import { ProductGrid } from "./product-grid";

const PRICE_PRESETS: { label: string; value: number | null }[] = [
  { label: "Any price", value: null },
  { label: "Under $300", value: 300 },
  { label: "Under $600", value: 600 },
  { label: "Under $1000", value: 1000 },
];

export function ProductList({
  initialProducts,
  initialHasNextPage,
  initialEndCursor,
  searchTerm,
  sort,
  quickAdd = true,
}: {
  initialProducts: Product[];
  initialHasNextPage: boolean;
  initialEndCursor: string | null;
  searchTerm?: string;
  sort?: { sortKey: "PRICE" | "BEST_SELLING" | "CREATED_AT"; reverse: boolean };
  quickAdd?: boolean;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [hasNextPage, setHasNextPage] = useState(initialHasNextPage);
  const [endCursor, setEndCursor] = useState(initialEndCursor);
  const [isPending, startTransition] = useTransition();
  // Client-side only — filters the products already fetched rather than re-querying Shopify, so
  // "Load more" still paginates the full (unfiltered) result set underneath it. A deliberately
  // scoped-down stand-in for full faceted search (brand/spec filters), same tradeoff the Ex-UK
  // filter sheet already makes over its own fetched batch.
  const [maxPrice, setMaxPrice] = useState<number | null>(null);

  const visibleProducts = useMemo(
    () =>
      maxPrice === null
        ? products
        : products.filter((p) => Number(p.priceRange.minVariantPrice.amount) <= maxPrice),
    [products, maxPrice],
  );

  function handleLoadMore() {
    if (!endCursor) return;
    startTransition(async () => {
      const page = await loadMoreProducts(endCursor, searchTerm, sort);
      setProducts((prev) => [...prev, ...page.products]);
      setHasNextPage(page.hasNextPage);
      setEndCursor(page.endCursor);
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-neutral-400">Price:</span>
        {PRICE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            aria-pressed={maxPrice === preset.value}
            onClick={() => setMaxPrice(preset.value)}
            className={`rounded-control border px-3 py-1.5 text-sm transition ${
              maxPrice === preset.value
                ? "border-foreground bg-foreground text-background"
                : "border-border-subtle text-neutral-600 hover:border-foreground hover:text-foreground"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <p className="mb-8 text-neutral-500" aria-live="polite">
        {maxPrice !== null
          ? `Showing ${visibleProducts.length} of ${products.length} products`
          : `Showing ${products.length} ${products.length === 1 ? "product" : "products"}`}
      </p>
      <ProductGrid products={visibleProducts} quickAdd={quickAdd} />
      {hasNextPage && (
        <div className="mt-10 flex justify-center">
          <button
            onClick={handleLoadMore}
            disabled={isPending}
            className="rounded-control border border-border-subtle px-6 py-2.5 text-sm font-medium transition hover:border-foreground disabled:opacity-50"
          >
            {isPending ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
