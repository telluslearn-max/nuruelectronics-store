import type { Metadata } from "next";
import { ComingSoonCarousel } from "@/components/coming-soon-carousel";
import { getComingSoonProducts } from "@/lib/shopify";

export const metadata: Metadata = {
  title: "Coming Soon",
  description: "Confirmed, not-yet-released phones and electronics landing at NURU soon.",
  alternates: { canonical: "/coming-soon" },
};

export default async function ComingSoonPage() {
  const products = await getComingSoonProducts();

  return (
    <div>
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-medium text-accent">Confirmed. Not yet released.</p>
        <h1 className="mt-2 text-title sm:text-display">Coming Soon</h1>
        <p className="mt-4 text-neutral-500">
          Phones and electronics with a confirmed release date. Ask to be notified the moment
          each one lands.
        </p>
      </div>

      <div className="mt-12">
        {products.length === 0 ? (
          <p className="text-center text-neutral-500">Nothing confirmed right now — check back soon.</p>
        ) : (
          <ComingSoonCarousel products={products} />
        )}
      </div>
    </div>
  );
}
