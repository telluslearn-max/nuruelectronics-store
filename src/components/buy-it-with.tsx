"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useCart } from "@/components/cart/cart-context";
import { addItems } from "@/lib/actions";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/shopify/types";

type BundleItem = {
  product: Product;
  variantId: string | undefined;
  price: { amount: string; currencyCode: string };
};

function toBundleItem(product: Product): BundleItem {
  // Bundling adds one fixed configuration per item (first available variant),
  // separate from whatever the shopper is configuring in the picker above —
  // same simplification noon's own "buy together" module makes.
  const variant = product.variants.find((v) => v.availableForSale) ?? product.variants[0];
  return { product, variantId: variant?.id, price: variant?.price ?? product.priceRange.minVariantPrice };
}

/** Real complementary products only — pulled from the same category mesh as "Complete the setup". */
export function BuyItWith({ current, extras }: { current: Product; extras: Product[] }) {
  const { setCart, openCart } = useCart();
  const [isPending, startTransition] = useTransition();

  const items = [current, ...extras].map(toBundleItem);
  const [checked, setChecked] = useState<Set<string>>(new Set(items.map((i) => i.product.handle)));

  if (extras.length === 0) return null;

  const selected = items.filter((i) => checked.has(i.product.handle) && i.variantId);
  const total = selected.reduce((sum, i) => sum + Number(i.price.amount), 0);
  const currency = items[0]?.price.currencyCode ?? "KES";

  function toggle(handle: string) {
    if (handle === current.handle) return;
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(handle)) next.delete(handle);
      else next.add(handle);
      return next;
    });
  }

  function addAll() {
    const lines = selected
      .filter((i): i is BundleItem & { variantId: string } => Boolean(i.variantId))
      .map((i) => ({ variantId: i.variantId, quantity: 1 }));
    if (lines.length === 0) return;
    startTransition(async () => {
      const cart = await addItems(lines);
      setCart(cart);
      openCart();
    });
  }

  return (
    <section className="mt-16">
      <h2 className="text-title">Buy it with</h2>
      <p className="mt-2 text-neutral-500">Real picks from the same category pairings as below.</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {items.map((item, i) => (
          <div key={item.product.handle} className="flex items-center gap-3">
            {i > 0 && <span className="text-xl text-neutral-300" aria-hidden="true">+</span>}
            <div className="flex w-24 flex-col items-center gap-2 text-center">
              {i > 0 ? (
                // <label> here only wraps the checkbox + image, never the
                // title link below — nesting an <a> inside a <label> lets
                // clicking the link also silently toggle the checkbox in
                // some browsers, which is exactly the bug this avoids.
                <label className="relative block h-20 w-20 cursor-pointer overflow-hidden rounded-lg bg-neutral-100">
                  {item.product.images[0] && (
                    <Image
                      src={item.product.images[0].url}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  )}
                  <input
                    type="checkbox"
                    checked={checked.has(item.product.handle)}
                    onChange={() => toggle(item.product.handle)}
                    aria-label={`Include ${item.product.title}`}
                    className="absolute left-1 top-1 h-4 w-4 accent-accent"
                  />
                </label>
              ) : (
                <div className="relative h-20 w-20 overflow-hidden rounded-lg bg-neutral-100">
                  {item.product.images[0] && (
                    <Image
                      src={item.product.images[0].url}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  )}
                </div>
              )}
              <Link
                href={`/products/${item.product.handle}`}
                className="line-clamp-2 text-xs text-neutral-600 hover:text-accent"
              >
                {item.product.title}
              </Link>
              <span className="text-xs font-medium text-neutral-500">
                {formatPrice(item.price.amount, item.price.currencyCode)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addAll}
        disabled={isPending || selected.length === 0}
        className="mt-6 rounded-control bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        {isPending
          ? "Adding..."
          : `Add ${selected.length} ${selected.length === 1 ? "item" : "together"} for ${formatPrice(String(total), currency)}`}
      </button>
    </section>
  );
}
