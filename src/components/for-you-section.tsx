"use client";

import { useEffect, useState } from "react";
import { ProductCarousel } from "@/components/product-carousel";
import { SectionHeading } from "@/components/section-heading";
import { useRecentlyViewedHandles } from "@/components/use-recently-viewed";
import { getPersonalizedHomepageProducts } from "@/lib/personalization/recommendations";
import type { Product } from "@/lib/shopify/types";

/** Homepage-only "For You" feed — Gemini-ranked from the shopper's own recently-viewed history. Renders nothing for new visitors or once ranking comes back empty. */
export function ForYouSection() {
  const handles = useRecentlyViewedHandles("");
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (handles.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProducts([]);
      return;
    }
    let cancelled = false;
    getPersonalizedHomepageProducts(handles).then((fetched) => {
      if (!cancelled) setProducts(fetched);
    });
    return () => {
      cancelled = true;
    };
  }, [handles]);

  if (products.length === 0) return null;

  return (
    <section className="mt-16">
      <SectionHeading eyebrow="Picked for you" title="For You" subtitle="Based on what you've been browsing." />
      <div className="mt-6">
        <ProductCarousel products={products} />
      </div>
    </section>
  );
}
