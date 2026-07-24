import type { ReactNode } from "react";
import Link from "next/link";
import { FeatureCarousel } from "@/components/feature-carousel";
import { ProductCarousel } from "@/components/product-carousel";
import { ProductList } from "@/components/product-list";
import { RelatedCategories, type RelatedCategoryEntry } from "@/components/related-categories";
import { SectionHeading } from "@/components/section-heading";
import { SITE_URL } from "@/lib/site";
import type { Product } from "@/lib/shopify/types";

const SORTS = [
  { slug: undefined, label: "Featured" },
  { slug: "price-asc", label: "Price: Low to High" },
  { slug: "price-desc", label: "Price: High to Low" },
] as const;

export function chipClass(isActive: boolean) {
  return `rounded-control border px-4 py-2 text-sm transition ${
    isActive
      ? "border-foreground bg-foreground text-background"
      : "border-border-subtle text-neutral-600 hover:border-foreground hover:text-foreground"
  }`;
}

export function CollectionPage({
  title,
  blurb,
  query,
  products,
  hasNextPage,
  endCursor,
  sort,
  sortSlug,
  buildHref,
  groupChips,
  flagshipProducts,
  comingSoonProducts,
  relatedCategories,
  categoryNav,
  breadcrumb,
  categoryGuide,
}: {
  title: string;
  blurb: string;
  query: string;
  products: Product[];
  hasNextPage: boolean;
  endCursor: string | null;
  sort?: { sortKey: "PRICE"; reverse: boolean };
  sortSlug?: string;
  buildHref: (sort?: string) => string;
  groupChips?: ReactNode;
  /** Best-sellers shown as a highlight carousel above the full listing. */
  flagshipProducts?: Product[];
  /** Pre-release titles shown as their own rail, gaming category only. */
  comingSoonProducts?: Product[];
  /** Ranked complementary categories to cross-sell below the listing, most relevant first. */
  relatedCategories?: RelatedCategoryEntry[];
  /** "Shop by category" navigation shown at the very top of the page, above the flagship carousel. */
  categoryNav?: ReactNode;
  /** Breadcrumb trail shown above the title. */
  breadcrumb?: ReactNode;
  /** Long-form buying guide, shown after the product listing — category pages only. */
  categoryGuide?: ReactNode;
}) {
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${SITE_URL}/products/${product.handle}`,
      name: product.title,
    })),
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      {breadcrumb}

      <div className="mb-4">
        <h1 className="text-title sm:text-display">{title}</h1>
        <p className="mt-2 text-neutral-500">{blurb}</p>
        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
          Genuine &bull; Manufacturer warranty &bull; Fast Nairobi delivery
        </p>
      </div>

      {categoryNav}

      {flagshipProducts && flagshipProducts.length > 0 && (
        <section className="mb-12">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
            <SectionHeading eyebrow="Popular right now" title={`Top picks in ${title}`} />
            <a href="#all-products" className="shrink-0 text-sm font-medium text-accent hover:opacity-80">
              See all &darr;
            </a>
          </div>
          <FeatureCarousel products={flagshipProducts} />
        </section>
      )}

      {comingSoonProducts && comingSoonProducts.length > 0 && (
        <section className="mb-12">
          <SectionHeading eyebrow="Pre-order" title="Coming Soon" />
          <div className="mt-4">
            <ProductCarousel products={comingSoonProducts} />
          </div>
        </section>
      )}

      {groupChips}

      <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="text-neutral-400">Sort:</span>
        {SORTS.map((s) => {
          const isActive = (sortSlug ?? undefined) === s.slug || (!sortSlug && !s.slug);
          return (
            <Link
              key={s.label}
              href={buildHref(s.slug)}
              aria-current={isActive ? "true" : undefined}
              className={
                isActive
                  ? "font-medium text-foreground underline underline-offset-4"
                  : "text-neutral-500 transition hover:text-foreground"
              }
            >
              {s.label}
            </Link>
          );
        })}
      </div>

      <div id="all-products" className="scroll-mt-24">
        <ProductList
          key={`${query}|${sortSlug ?? "featured"}`}
          initialProducts={products}
          initialHasNextPage={hasNextPage}
          initialEndCursor={endCursor}
          searchTerm={query}
          sort={sort}
        />
      </div>

      {categoryGuide}

      <RelatedCategories title={title} items={relatedCategories ?? []} />
    </div>
  );
}
