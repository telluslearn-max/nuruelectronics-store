"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductCard } from "@/components/product-card";
import { getProductsByHandles } from "@/lib/actions";
import type { Product } from "@/lib/shopify/types";
import { useWishlist } from "./wishlist-context";

export function WishlistSection() {
  const { items } = useWishlist();
  const [products, setProducts] = useState<Product[] | null>(null);

  useEffect(() => {
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
    <section>
      <h2 className="text-lg font-medium">Saved items</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-neutral-500">
          You haven&apos;t saved anything yet.{" "}
          <Link href="/shop" className="font-medium text-accent hover:opacity-80">
            Browse products
          </Link>
        </p>
      ) : products === null ? (
        <p className="mt-3 text-neutral-500">Loading…</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </section>
  );
}
