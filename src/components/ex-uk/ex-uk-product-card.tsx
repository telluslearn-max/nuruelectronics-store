"use client";

import { useState } from "react";
import { formatPrice, truncate } from "@/lib/format";
import type { Product } from "@/lib/shopify/types";
import { ProductMedia } from "@/components/product-media";

const KEY_SPEC_ORDER = ["processor", "ram", "storage", "battery", "camera", "display", "connectivity"];

export function ExUkProductCard({ product }: { product: Product }) {
  const [expanded, setExpanded] = useState(false);
  const image = product.images[0];
  const price = product.priceRange.minVariantPrice;
  const specs = [...(product.specs ?? [])].sort(
    (a, b) => KEY_SPEC_ORDER.indexOf(a.key) - KEY_SPEC_ORDER.indexOf(b.key),
  );

  return (
    <div className="flex h-full select-none flex-col overflow-hidden rounded-card border border-border-subtle bg-background shadow-lg">
      <div className="relative aspect-[4/5] shrink-0 overflow-hidden bg-neutral-100">
        <ProductMedia
          image={image}
          title={product.title}
          productType={product.productType}
          sizes="(min-width: 640px) 384px, 90vw"
          priority
        />
        <span className="absolute left-3 top-3 rounded-control bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
          Ex-UK · Unboxed · 1-Year Warranty
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold leading-snug">{product.title}</h3>
          <p className="shrink-0 text-base font-medium text-neutral-700">
            {formatPrice(price.amount, price.currencyCode)}
          </p>
        </div>

        {specs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {specs.slice(0, 4).map((spec) => (
              <span
                key={spec.key}
                className="rounded-control border border-border-subtle px-2 py-0.5 text-xs text-neutral-600"
              >
                {spec.value}
              </span>
            ))}
          </div>
        )}

        <div className="text-sm text-neutral-600">
          <p>{expanded ? product.description : truncate(product.description, 110)}</p>
          {product.description.length > 110 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
              className="mt-1 text-sm font-medium text-accent"
            >
              {expanded ? "Show less" : "More info"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
