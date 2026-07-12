import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { CollectionPage } from "@/components/collection-page";
import { IconStrip } from "@/components/icon-strip";
import { categories, categoryForProductType } from "@/lib/categories";
import { getEcosystem } from "@/lib/collections";
import { getProducts } from "@/lib/shopify";

type EcosystemPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; category?: string }>;
};

function buildHref(slug: string, category?: string, sort?: string) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (sort) params.set("sort", sort);
  const qs = params.toString();
  return `/ecosystem/${slug}${qs ? `?${qs}` : ""}`;
}

export async function generateMetadata({ params, searchParams }: EcosystemPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { category } = await searchParams;
  const ecosystem = getEcosystem(slug);
  if (!ecosystem) return {};
  // A category filter is a genuinely different product set, so it gets its
  // own canonical; sort only reorders that same set, so it's always dropped.
  const canonical = category ? `/ecosystem/${slug}?category=${category}` : `/ecosystem/${slug}`;
  return { title: ecosystem.label, description: ecosystem.blurb, alternates: { canonical } };
}

export default async function EcosystemPage({ params, searchParams }: EcosystemPageProps) {
  const { slug } = await params;
  const { sort: sortSlug, category: categorySlug } = await searchParams;
  const ecosystem = getEcosystem(slug);

  if (!ecosystem) {
    notFound();
  }

  const sort =
    sortSlug === "price-asc"
      ? { sortKey: "PRICE" as const, reverse: false }
      : sortSlug === "price-desc"
        ? { sortKey: "PRICE" as const, reverse: true }
        : undefined;

  // Fetched unfiltered by category, purely to know which categories this
  // brand actually stocks — so the "shop by category" strip never links to
  // an empty result.
  const allBrandProducts = await getProducts({ searchTerm: ecosystem.query, first: 100 });
  const brandCategories = categories.filter((category) =>
    allBrandProducts.products.some((p) => categoryForProductType(p.productType)?.slug === category.slug),
  );
  const activeCategory = brandCategories.find((c) => c.slug === categorySlug);

  // One representative photo per category, for the "shop by category" strip —
  // the first matching product's primary image, in catalog order.
  const categoryImages = new Map<string, { url: string; altText: string | null }>();
  for (const product of allBrandProducts.products) {
    const slug = categoryForProductType(product.productType)?.slug;
    if (slug && !categoryImages.has(slug) && product.images[0]) {
      categoryImages.set(slug, product.images[0]);
    }
  }

  const query = activeCategory ? `(${ecosystem.query}) AND (${activeCategory.query})` : ecosystem.query;

  const { products, hasNextPage, endCursor } = await getProducts({
    searchTerm: query,
    sortKey: sort?.sortKey,
    reverse: sort?.reverse,
  });

  const categoryNav = brandCategories.length > 1 && (
    <section aria-label="Shop by category" className="mb-10">
      <p className="mb-4 text-xs font-medium uppercase tracking-wide text-neutral-400">
        Shop {ecosystem.label} by category
      </p>
      <IconStrip
        items={[
          { slug: "all", label: "All", art: "generic" },
          ...brandCategories.map((c) => ({
            slug: c.slug,
            label: ecosystem.categoryLabels?.[c.slug] ?? c.label,
            art: c.art,
            image: categoryImages.get(c.slug),
          })),
        ]}
        activeSlug={activeCategory?.slug ?? "all"}
        hrefFor={(itemSlug) =>
          buildHref(ecosystem.slug, itemSlug === "all" ? undefined : itemSlug, sortSlug)
        }
      />
    </section>
  );

  return (
    <CollectionPage
      title={ecosystem.label}
      blurb={ecosystem.blurb}
      query={query}
      products={products}
      hasNextPage={hasNextPage}
      endCursor={endCursor}
      sort={sort}
      sortSlug={sortSlug}
      buildHref={(sort) => buildHref(ecosystem.slug, activeCategory?.slug, sort)}
      categoryNav={categoryNav}
      breadcrumb={
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Shop by Brand", href: "/ecosystem" },
            { label: ecosystem.label },
          ]}
        />
      }
    />
  );
}
