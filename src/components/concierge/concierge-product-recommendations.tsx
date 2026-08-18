"use client";

import { useRef, useState } from "react";
import type { Product } from "@/lib/shopify/types";
import { useHorizontalWheelPassthrough } from "../use-horizontal-wheel-passthrough";
import { ConciergeCarouselCard } from "./concierge-carousel-card";
import { ConciergeProductCard } from "./concierge-product-card";

const CAROUSEL_CAP = 6;
const GAP_PX = 12; // matches gap-3

export function ConciergeProductRecommendations({ products }: { products: Product[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const visible = products.slice(0, CAROUSEL_CAP);
  const remainder = products.slice(CAROUSEL_CAP);

  function slideWidth() {
    const first = trackRef.current?.children[0] as HTMLElement | undefined;
    return first ? first.getBoundingClientRect().width + GAP_PX : 0;
  }

  function handleScroll() {
    const track = trackRef.current;
    const width = slideWidth();
    if (!track || !width) return;
    const index = Math.round(track.scrollLeft / width);
    setActiveIndex(Math.min(Math.max(index, 0), visible.length - 1));
  }

  function goTo(index: number) {
    const track = trackRef.current;
    const width = slideWidth();
    if (!track || !width) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({ left: index * width, behavior: reduceMotion ? "auto" : "smooth" });
  }

  const handleWheel = useHorizontalWheelPassthrough<HTMLDivElement>();

  return (
    <div className="mt-3 rounded-card border border-border-subtle p-3">
      <p className="mb-2 text-sm font-semibold">Product Recommendations</p>

      <div
        ref={trackRef}
        onScroll={handleScroll}
        onWheel={handleWheel}
        className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-smooth pb-1"
      >
        {visible.map((product) => (
          <div key={product.handle} className="w-40 shrink-0 snap-start sm:w-48">
            <ConciergeCarouselCard product={product} />
          </div>
        ))}
      </div>

      {visible.length > 1 && (
        <div role="group" aria-label="Carousel pagination" className="mt-2 flex justify-center gap-1.5">
          {visible.map((product, index) => (
            <button
              key={product.handle}
              type="button"
              aria-label={`Show product ${index + 1} of ${visible.length}`}
              aria-current={index === activeIndex ? "true" : undefined}
              onClick={() => goTo(index)}
              className={`h-1.5 rounded-full transition-all ${
                index === activeIndex ? "w-4 bg-accent" : "w-1.5 bg-neutral-300"
              }`}
            />
          ))}
        </div>
      )}

      {remainder.length > 0 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 block w-full text-center text-sm font-medium text-accent hover:opacity-80"
        >
          See All Recommendations
        </button>
      )}

      {expanded && remainder.length > 0 && (
        <div className="mt-3 grid max-h-72 grid-cols-2 gap-3 overflow-y-auto pr-1">
          {remainder.map((product) => (
            <ConciergeProductCard key={product.handle} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
