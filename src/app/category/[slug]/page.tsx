import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductList } from "@/components/product-list";
import { getCategory } from "@/lib/categories";
import { getProducts } from "@/lib/shopify";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ series?: string; sort?: string }>;
};

const SORTS = [
  { slug: undefined, label: "Featured" },
  { slug: "price-asc", label: "Price: Low to High" },
  { slug: "price-desc", label: "Price: High to Low" },
] as const;

function chipClass(isActive: boolean) {
  return `rounded-control border px-4 py-1.5 text-sm transition ${
    isActive
      ? "border-foreground bg-foreground text-background"
      : "border-border-subtle text-neutral-600 hover:border-foreground hover:text-foreground"
  }`;
}

function buildHref(slug: string, series?: string, sort?: string) {
  const params = new URLSearchParams();
  if (series) params.set("series", series);
  if (sort) params.set("sort", sort);
  const qs = params.toString();
  return `/category/${slug}${qs ? `?${qs}` : ""}`;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) return {};
  return { title: category.label, description: category.blurb };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params;
  const { series: seriesSlug, sort: sortSlug } = await searchParams;
  const category = getCategory(slug);

  if (!category) {
    notFound();
  }

  const activeSeries = category.series?.find((s) => s.slug === seriesSlug);
  const query = activeSeries?.query ?? category.query;
  const sort =
    sortSlug === "price-asc"
      ? { sortKey: "PRICE" as const, reverse: false }
      : sortSlug === "price-desc"
        ? { sortKey: "PRICE" as const, reverse: true }
        : undefined;

  const { products, hasNextPage, endCursor } = await getProducts({
    searchTerm: query,
    sortKey: sort?.sortKey,
    reverse: sort?.reverse,
  });

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: category.label,
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
        <h1 className="text-title sm:text-3xl">{category.label}</h1>
        <p className="mt-2 text-neutral-500">{category.blurb}</p>
      </div>

      {category.series && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Link href={buildHref(category.slug, undefined, sortSlug)} className={chipClass(!activeSeries)}>
            All
          </Link>
          {category.series.map((s) => (
            <Link
              key={s.slug}
              href={buildHref(category.slug, s.slug, sortSlug)}
              className={chipClass(activeSeries?.slug === s.slug)}
            >
              {s.label}
            </Link>
          ))}
        </div>
      )}

      <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="text-neutral-400">Sort:</span>
        {SORTS.map((s) => {
          const isActive = (sortSlug ?? undefined) === s.slug || (!sortSlug && !s.slug);
          return (
            <Link
              key={s.label}
              href={buildHref(category.slug, activeSeries?.slug, s.slug)}
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
