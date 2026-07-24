"use client";

import { useEffect, useState } from "react";
import { ProductCarousel } from "@/components/product-carousel";
import { SectionHeading } from "@/components/section-heading";
import { useRecentlyViewedHandles, useRecordProductView } from "@/components/use-recently-viewed";
import { getProductsByHandles } from "@/lib/actions";
import type { Product } from "@/lib/shopify/types";

export function RecentlyViewedCarousel({ currentHandle }: { currentHandle: string }) {
  useRecordProductView(currentHandle);
  const handles = useRecentlyViewedHandles(currentHandle);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (handles.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProducts([]);
      return;
    }
    let cancelled = false;
    getProductsByHandles(handles)
      .then((fetched) => {
        if (!cancelled) setProducts(fetched);
      })
      .catch((error) => {
        console.error("Failed to load recently viewed products:", error);
        if (!cancelled) setProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [handles]);

  if (products.length === 0) return null;

  return (
    <section className="mt-16">
      <SectionHeading eyebrow="Your history" title="Recently viewed" />
      <div className="mt-6">
        <ProductCarousel products={products} />
      </div>
    </section>
  );
}
