"use client";

import { useState } from "react";
import { formatPrice, truncate } from "@/lib/format";
import type { Product } from "@/lib/shopify/types";
import { ProductMedia } from "@/components/product-media";

const KEY_SPEC_ORDER = ["processor", "ram", "storage", "battery", "camera", "display", "connectivity"];

export function ExUkProductCard({ product }: { product: Product }) {
  const [expanded, setExpanded] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const image = product.images[photoIndex] ?? product.images[0];
  const price = product.priceRange.minVariantPrice;
  const specs = [...(product.specs ?? [])].sort(
    (a, b) => KEY_SPEC_ORDER.indexOf(a.key) - KEY_SPEC_ORDER.indexOf(b.key),
  );

  return (
    <div className="relative h-full select-none overflow-hidden rounded-card bg-neutral-900 shadow-lg">
      <ProductMedia
        image={image}
        title={product.title}
        productType={product.productType}
        sizes="(min-width: 640px) 384px, 90vw"
        priority
        className="object-cover"
      />

      <span className="absolute left-3 top-3 rounded-control bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
        Ex-UK · Unboxed · 1-Year Warranty
      </span>

      {product.images.length > 1 && (
        <div className="absolute inset-x-0 top-11 flex justify-center gap-1.5">
          {product.images.map((img, i) => (
            <button
              key={img.url + i}
              type="button"
              aria-label={`Show photo ${i + 1} of ${product.images.length}`}
              aria-current={i === photoIndex}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setPhotoIndex(i);
              }}
              className={`h-1.5 w-1.5 rounded-full transition ${
                i === photoIndex ? "bg-white" : "bg-white/40"
              }`}
            />
          ))}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-4 pb-4 pt-16 text-white">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold leading-snug">{product.title}</h3>
          <p className="shrink-0 text-base font-medium">{formatPrice(price.amount, price.currencyCode)}</p>
        </div>

        {specs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {specs.slice(0, 4).map((spec) => (
              <span
                key={spec.key}
                className="rounded-control border border-white/30 bg-white/10 px-2 py-0.5 text-xs text-white/90"
              >
                {spec.value}
              </span>
            ))}
          </div>
        )}

        <div className="max-h-[45%] overflow-y-auto text-sm text-white/80">
          <p>{expanded ? product.description : truncate(product.description, 110)}</p>
          {product.description.length > 110 && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
              className="mt-1 text-sm font-medium text-white underline underline-offset-2"
            >
              {expanded ? "Show less" : "More info"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
