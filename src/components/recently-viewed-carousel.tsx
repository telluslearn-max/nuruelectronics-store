"use client";

import { ProductCarousel } from "@/components/product-carousel";
import { SectionHeading } from "@/components/section-heading";
import { useRecentlyViewedHandles, useRecordProductView } from "@/components/use-recently-viewed";
import { useHandleProducts } from "@/components/use-handle-products";

export function RecentlyViewedCarousel({ currentHandle }: { currentHandle: string }) {
  useRecordProductView(currentHandle);
  const handles = useRecentlyViewedHandles(currentHandle);
  const products = useHandleProducts(handles) ?? [];

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
