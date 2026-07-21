"use client";

import { useEffect, useRef, useState } from "react";
import { ProductMedia } from "@/components/product-media";
import { WhatsAppOrderButton } from "@/components/whatsapp-order-button";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/shopify/types";
import { sortSpecs } from "./spec-order";

/**
 * Full-detail overlay opened by tapping a card, within the same Ex-UK shell (no site chrome) —
 * shows everything the teaser card truncates: every photo, the full spec list, and the full
 * description. The bottom action row performs the real pass/love decision (same as swiping the
 * card); the close button just dismisses the sheet without deciding anything.
 */
export function ExUkProductDetail({
  product,
  onClose,
  onSwipe,
}: {
  product: Product;
  onClose: () => void;
  onSwipe: (direction: "left" | "right") => void;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const image = product.images[photoIndex] ?? product.images[0];
  const price = product.priceRange.minVariantPrice;
  const specs = sortSpecs(product.specs);

  useEffect(() => {
    closeButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${product.title} details`}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-4 py-3">
        <button
          ref={closeButtonRef}
          onClick={onClose}
          aria-label="Close details"
          className="flex h-9 w-9 items-center justify-center rounded-control text-2xl leading-none hover:bg-neutral-100"
        >
          &times;
        </button>
        <span className="text-sm font-semibold">Ex-UK · Unboxed · 1-Year Warranty</span>
        <span className="w-9" aria-hidden="true" />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="relative aspect-square w-full bg-neutral-100">
          <ProductMedia image={image} title={product.title} productType={product.productType} sizes="100vw" priority />
        </div>

        {product.images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto p-3">
            {product.images.map((img, i) => (
              <button
                key={img.url + i}
                type="button"
                aria-label={`Show photo ${i + 1} of ${product.images.length}`}
                aria-current={i === photoIndex}
                onClick={() => setPhotoIndex(i)}
                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-control border-2 ${
                  i === photoIndex ? "border-accent" : "border-transparent"
                }`}
              >
                <ProductMedia image={img} title={product.title} sizes="64px" />
              </button>
            ))}
          </div>
        )}

        <div className="space-y-4 px-4 pb-6">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg font-semibold leading-snug">{product.title}</h2>
            <p className="shrink-0 text-lg font-medium">{formatPrice(price.amount, price.currencyCode)}</p>
          </div>

          {specs.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {specs.map((spec) => (
                <span
                  key={spec.key}
                  className="rounded-control border border-border-subtle px-2.5 py-1 text-sm text-neutral-600"
                >
                  {spec.value}
                </span>
              ))}
            </div>
          )}

          <p className="text-sm leading-relaxed text-neutral-700">{product.description}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-center gap-6 border-t border-border-subtle py-4">
        <button
          type="button"
          aria-label={`Pass on ${product.title}`}
          onClick={() => onSwipe("left")}
          className="flex h-14 w-14 items-center justify-center rounded-control border border-border-subtle text-2xl text-neutral-500 transition hover:border-neutral-400"
        >
          ✕
        </button>
        <WhatsAppOrderButton
          productTitle={product.title}
          price={formatPrice(price.amount, price.currencyCode)}
          productHandle={product.handle}
          compact
        />
        <button
          type="button"
          aria-label={`Love ${product.title}`}
          onClick={() => onSwipe("right")}
          className="flex h-14 w-14 items-center justify-center rounded-control bg-accent text-2xl text-accent-foreground transition hover:opacity-90"
        >
          ♥
        </button>
      </div>
    </div>
  );
}
