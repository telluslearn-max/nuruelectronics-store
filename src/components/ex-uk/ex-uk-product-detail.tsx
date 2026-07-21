"use client";

import { useEffect, useRef, useState } from "react";
import { ProductMedia } from "@/components/product-media";
import { WhatsAppOrderButton } from "@/components/whatsapp-order-button";
import { formatPrice } from "@/lib/format";
import type { Savings } from "@/lib/product-match";
import type { Product } from "@/lib/shopify/types";
import { gradeForProduct } from "./condition-grade";
import { sortSpecs } from "./spec-order";

/**
 * Full-detail overlay opened by tapping a card, within the same Ex-UK shell (no site chrome) —
 * shows everything the teaser card truncates: every photo, the full spec list, and the full
 * description. The bottom action row performs the real pass/love decision (same as swiping the
 * card); the close button just dismisses the sheet without deciding anything.
 */
export function ExUkProductDetail({
  product,
  savings,
  onClose,
  onSwipe,
}: {
  product: Product;
  savings?: Savings | null;
  onClose: () => void;
  onSwipe: (direction: "left" | "right") => void;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const image = product.images[photoIndex] ?? product.images[0];
  const price = product.priceRange.minVariantPrice;
  const specs = sortSpecs(product.specs);
  const grade = gradeForProduct(product.tags);

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
      <div className="flex shrink-0 items-center border-b border-border-subtle px-4 py-3">
        <button
          ref={closeButtonRef}
          onClick={onClose}
          aria-label="Close details"
          className="flex h-9 w-9 items-center justify-center rounded-control text-2xl leading-none hover:bg-neutral-100"
        >
          &times;
        </button>
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

        <div className="px-4 pb-6">
          <div className="flex items-start justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-lg font-semibold leading-snug">
              {product.title}
              <svg
                viewBox="0 0 20 20"
                className="h-4 w-4 shrink-0 text-accent"
                fill="currentColor"
                aria-label="Tested & verified"
              >
                <title>Tested &amp; verified</title>
                <path d="M10 1.5 12.4 4l3.4-.6.6 3.4 2.5 2.4-2.5 2.4-.6 3.4-3.4-.6L10 17l-2.4-2.6-3.4.6-.6-3.4L1.1 9.2l2.5-2.4.6-3.4L7.6 4 10 1.5Z" />
                <path
                  d="M6.8 9.4l2 2 4.2-4.4"
                  fill="none"
                  stroke="var(--background)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </h2>
            <p className="shrink-0 text-lg font-medium">{formatPrice(price.amount, price.currencyCode)}</p>
          </div>

          <div className="mt-2 space-y-1 text-sm text-neutral-600">
            <p>📦 Unboxed · imported from the UK</p>
            <p>🛡️ 1-year warranty included</p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-control bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent">
              ✅ Condition: {grade ? `${grade.label} — ${grade.description}` : "Fully tested & unboxed"}
            </span>
            {savings && (
              <span className="inline-flex items-center rounded-control bg-green-600/10 px-3 py-1.5 text-sm font-medium text-green-700">
                💰 Save {formatPrice(savings.amount, savings.currencyCode)} ({savings.percent}%) vs new
              </span>
            )}
          </div>

          {specs.length > 0 && (
            <div className="mt-5 border-t border-border-subtle pt-4">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Specs</h3>
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
            </div>
          )}

          <div className="mt-5 border-t border-border-subtle pt-4">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">About this unit</h3>
            <p className="text-sm leading-relaxed text-neutral-700">{product.description}</p>
          </div>
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
