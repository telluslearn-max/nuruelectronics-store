"use client";

import { useState, useTransition } from "react";
import { addItem } from "@/lib/actions";
import type { Product } from "@/lib/shopify/types";
import { useCart } from "./cart-context";

export function QuickAddToCartButton({ product, className }: { product: Product; className?: string }) {
  const { setCart, openCart } = useCart();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const variant = product.variants.length === 1 ? product.variants[0] : undefined;
  if (!variant || !product.availableForSale || !variant.availableForSale) return null;

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setError(null);
          startTransition(async () => {
            try {
              const cart = await addItem(variant.id, 1);
              setCart(cart);
              openCart();
            } catch {
              setError("Couldn't add to cart.");
            }
          });
        }}
        className={`w-full rounded-control border border-border-subtle py-2 text-xs font-medium transition hover:border-foreground disabled:opacity-50 ${className ?? ""}`}
      >
        {isPending ? "Adding…" : "+ Add to cart"}
      </button>
      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
