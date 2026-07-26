"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CompareTable } from "@/components/compare/compare-table";
import { useCompare } from "@/components/compare/compare-context";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { getProductsByHandles } from "@/lib/actions";
import type { Product } from "@/lib/shopify/types";

export function ComparePageClient() {
  const { items, removeFromCompare, clearCompare } = useCompare();
  const [products, setProducts] = useState<Product[] | null>(null);

  useEffect(() => {
    // Empty case is already handled by the items.length === 0 branch below,
    // before products is ever read — nothing to fetch or set here.
    if (items.length === 0) return;
    let cancelled = false;
    getProductsByHandles(items.map((i) => i.handle)).then((result) => {
      if (!cancelled) setProducts(result);
    });
    return () => {
      cancelled = true;
    };
  }, [items]);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-title">Compare</h1>
          <p className="mt-2 text-neutral-500">
            Products you&apos;ve chosen to compare, side by side.
          </p>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={clearCompare}
            className="shrink-0 rounded-control border border-border-subtle px-4 py-2 text-sm font-medium transition hover:border-foreground"
          >
            Clear all
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-neutral-500">
            You haven&apos;t added anything to compare yet.
          </p>
          <Link
            href="/shop"
            className="mt-8 rounded-control bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
          >
            Browse products
          </Link>
        </div>
      ) : products === null ? (
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {items.map((item) => (
            <div key={item.handle}>
              <div className="aspect-square animate-pulse rounded-card bg-neutral-100" />
              <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-neutral-100" />
              <div className="mt-2 h-8 w-full animate-pulse rounded-control bg-neutral-100" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-10">
          <CompareTable
            columns={products}
            renderColumnHeader={(p) => (
              <div className="mt-2 space-y-3">
                <Link
                  href={`/products/${p.handle}`}
                  className="block text-sm font-semibold hover:text-accent"
                >
                  {p.title}
                </Link>
                <button
                  type="button"
                  onClick={() => removeFromCompare(p.handle)}
                  className="block text-xs font-medium text-neutral-500 hover:text-foreground"
                >
                  Remove
                </button>
                <div className="w-36">
                  <AddToCartButton
                    variantId={p.variants[0]?.id}
                    availableForSale={p.availableForSale}
                  />
                </div>
              </div>
            )}
          />
        </div>
      )}
    </div>
  );
}
