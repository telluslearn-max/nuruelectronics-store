"use client";

import Image from "next/image";
import { useState } from "react";
import type { ProductImage } from "@/lib/shopify/types";
import { ProductMedia } from "./product-media";

export function ProductGallery({
  images,
  title,
  productType,
}: {
  images: ProductImage[];
  title: string;
  productType?: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex];

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-card bg-neutral-100">
        <ProductMedia
          image={active}
          title={title}
          productType={productType}
          sizes="(min-width: 768px) 50vw, 100vw"
          priority
        />
      </div>

      {images.length > 1 && (
        <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-5 sm:gap-3">
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Show image ${index + 1} of ${images.length}`}
              className={`relative aspect-square overflow-hidden rounded-lg bg-neutral-100 ring-2 transition ${
                index === activeIndex ? "ring-foreground" : "ring-transparent hover:ring-border-subtle"
              }`}
            >
              <Image
                src={image.url}
                alt={image.altText ?? title}
                fill
                className="object-cover"
                sizes="20vw"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
