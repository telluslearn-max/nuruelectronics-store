"use client";

import Image from "next/image";
import { useState } from "react";
import type { ProductImage } from "@/lib/shopify/types";
import { ProductMedia } from "./product-media";

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12.5 4 6 10l6.5 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7.5 4 14 10l-6.5 6" />
    </svg>
  );
}

export function ProductGallery({
  images,
  title,
  productType,
  overlayActions,
}: {
  images: ProductImage[];
  title: string;
  productType?: string;
  /** Wishlist/compare-style toggle buttons overlaid on the image, mobile only — desktop keeps its own placement beside the title. */
  overlayActions?: React.ReactNode;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex];

  function step(direction: 1 | -1) {
    setActiveIndex((i) => (i + direction + images.length) % images.length);
  }

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
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-border-subtle bg-background/90 p-2 shadow-md backdrop-blur-sm transition hover:border-foreground"
            >
              <ChevronLeftIcon />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next image"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-border-subtle bg-background/90 p-2 shadow-md backdrop-blur-sm transition hover:border-foreground"
            >
              <ChevronRightIcon />
            </button>
          </>
        )}
        {overlayActions && (
          <div className="absolute right-3 top-3 flex flex-col gap-2 md:hidden">{overlayActions}</div>
        )}
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
