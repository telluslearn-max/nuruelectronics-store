import Link from "next/link";
import { ProductCarousel } from "@/components/product-carousel";
import { SectionHeading } from "@/components/section-heading";
import type { Product } from "@/lib/shopify/types";

export type RelatedCategoryEntry = {
  label: string;
  slug: string;
  reason: string;
  products: Product[];
};

/** Cross-sell block driven by the category mesh graph — used on both category and product pages. */
export function RelatedCategories({
  title,
  items,
}: {
  title: string;
  items: RelatedCategoryEntry[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="mt-16 rounded-card bg-neutral-50 px-6 py-10 sm:px-10">
      <SectionHeading eyebrow="Complete the setup" title={`What pairs well with ${title}`} />
      <div className="mt-8 space-y-10">
        {items.map((related) => (
          <div key={related.slug}>
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <div>
                <h3 className="font-semibold">{related.label}</h3>
                <p className="text-sm text-neutral-500">{related.reason}</p>
              </div>
              <Link
                href={`/category/${related.slug}`}
                className="shrink-0 text-sm font-medium text-accent hover:opacity-80"
              >
                Shop {related.label}
              </Link>
            </div>
            <ProductCarousel products={related.products} />
          </div>
        ))}
      </div>
    </section>
  );
}
