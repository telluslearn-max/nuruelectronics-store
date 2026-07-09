import type { ReactNode } from "react";
import Link from "next/link";
import { ProductList } from "@/components/product-list";
import type { Product } from "@/lib/shopify/types";

const SORTS = [
  { slug: undefined, label: "Featured" },
  { slug: "price-asc", label: "Price: Low to High" },
  { slug: "price-desc", label: "Price: High to Low" },
] as const;

export function chipClass(isActive: boolean) {
  return `rounded-control border px-4 py-1.5 text-sm transition ${
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
}) {
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `https://www.nuruelectronics.com/products/${product.handle}`,
      name: product.title,
    })),
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <div className="mb-8">
        <h1 className="text-title sm:text-3xl">{title}</h1>
        <p className="mt-2 text-neutral-500">{blurb}</p>
      </div>

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

      <ProductList
        key={`${query}|${sortSlug ?? "featured"}`}
        initialProducts={products}
        initialHasNextPage={hasNextPage}
        initialEndCursor={endCursor}
        searchTerm={query}
        sort={sort}
      />
    </div>
  );
}
