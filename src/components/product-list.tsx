"use client";

import { useMemo, useState, useTransition } from "react";
import { loadMoreProducts } from "@/lib/actions";
import type { Product } from "@/lib/shopify/types";
import { ProductGrid } from "./product-grid";

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function FacetChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`shrink-0 rounded-control border px-3 py-1.5 text-sm transition ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border-subtle text-neutral-600 hover:border-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

// A single scrollable line per facet, rather than wrapping — a facet with many
// values (e.g. Color on a product line with a dozen finishes) would otherwise
// stack into several rows and push the actual product grid far down the page.
function FacetRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="shrink-0 text-sm text-neutral-400">{label}:</span>
      <div className="scrollbar-none flex gap-2 overflow-x-auto">{children}</div>
    </div>
  );
}

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
  // "Load more" still paginates the full (unfiltered) result set underneath it. Brand and Color
  // are derived from whatever's actually in the current batch, not a fixed taxonomy, so the facet
  // rows only ever offer choices that exist in view.
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());

  const brands = useMemo(
    () =>
      Array.from(new Set(products.map((p) => p.vendor).filter((v): v is string => Boolean(v)))).sort(),
    [products],
  );

  const colors = useMemo(() => {
    const set = new Set<string>();
    for (const product of products) {
      const colorOption = product.options.find((o) => o.name === "Color");
      colorOption?.values.forEach((value) => set.add(value));
    }
    return Array.from(set).sort();
  }, [products]);

  const hasActiveFilters = selectedBrands.size > 0 || selectedColors.size > 0;

  const visibleProducts = useMemo(
    () =>
      products.filter((product) => {
        if (selectedBrands.size > 0 && (!product.vendor || !selectedBrands.has(product.vendor))) return false;
        if (selectedColors.size > 0) {
          const colorOption = product.options.find((o) => o.name === "Color");
          if (!colorOption || !colorOption.values.some((value) => selectedColors.has(value))) return false;
        }
        return true;
      }),
    [products, selectedBrands, selectedColors],
  );

  function clearFilters() {
    setSelectedBrands(new Set());
    setSelectedColors(new Set());
  }

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
      {brands.length > 1 && (
        <FacetRow label="Brand">
          {brands.map((brand) => (
            <FacetChip
              key={brand}
              label={brand}
              active={selectedBrands.has(brand)}
              onClick={() => setSelectedBrands((prev) => toggleInSet(prev, brand))}
            />
          ))}
        </FacetRow>
      )}

      {colors.length > 0 && (
        <FacetRow label="Color">
          {colors.map((color) => (
            <FacetChip
              key={color}
              label={color}
              active={selectedColors.has(color)}
              onClick={() => setSelectedColors((prev) => toggleInSet(prev, color))}
            />
          ))}
        </FacetRow>
      )}

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <p className="text-neutral-500" aria-live="polite">
          {hasActiveFilters
            ? `Showing ${visibleProducts.length} of ${products.length} products`
            : `Showing ${products.length} ${products.length === 1 ? "product" : "products"}`}
        </p>
        {hasActiveFilters && (
          <button type="button" onClick={clearFilters} className="text-sm text-accent underline hover:opacity-80">
            Clear filters
          </button>
        )}
      </div>

      {visibleProducts.length === 0 && hasActiveFilters ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border-subtle p-12 text-center">
          <p className="text-sm font-medium">No products match these filters</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-2 rounded-control border border-border-subtle px-4 py-2 text-sm font-medium transition hover:border-foreground"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ProductGrid products={visibleProducts} quickAdd={quickAdd} />
      )}

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
