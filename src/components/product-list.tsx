"use client";

import { useState, useTransition } from "react";
import { loadMoreProducts } from "@/lib/actions";
import type { Product } from "@/lib/shopify/types";
import { ProductGrid } from "./product-grid";

export function ProductList({
  initialProducts,
  initialHasNextPage,
  initialEndCursor,
}: {
  initialProducts: Product[];
  initialHasNextPage: boolean;
  initialEndCursor: string | null;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [hasNextPage, setHasNextPage] = useState(initialHasNextPage);
  const [endCursor, setEndCursor] = useState(initialEndCursor);
  const [isPending, startTransition] = useTransition();

  function handleLoadMore() {
    if (!endCursor) return;
    startTransition(async () => {
      const page = await loadMoreProducts(endCursor);
      setProducts((prev) => [...prev, ...page.products]);
      setHasNextPage(page.hasNextPage);
      setEndCursor(page.endCursor);
    });
  }

  return (
    <div>
      <p className="mb-8 text-neutral-500">
        Showing {products.length} {products.length === 1 ? "product" : "products"}
      </p>
      <ProductGrid products={products} />
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
