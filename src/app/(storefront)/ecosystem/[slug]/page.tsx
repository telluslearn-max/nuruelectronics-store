import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { CollectionPage, parseSortSlug } from "@/components/collection-page";
import { HeroProductCard } from "@/components/hero-product-card";
import { IconStrip } from "@/components/icon-strip";
import { ProductList } from "@/components/product-list";
import { SectionHeading } from "@/components/section-heading";
import { TrustBadges } from "@/components/trust-badges";
import { categories, categoryForProductType, type Category } from "@/lib/categories";
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

  const breadcrumb = (
    <Breadcrumb
      items={[
        { label: "Home", href: "/" },
        { label: "Shop by Brand", href: "/ecosystem" },
        { label: ecosystem.label },
      ]}
    />
  );

  // Multi-category flagship brands get the premium "hub" treatment (hero
  // flagship cards, a device-line category split, a dedicated trust
  // section) instead of the generic listing layout — originally built for
  // Apple, generalized here to every `featured` ecosystem.
  if (ecosystem.featured) {
    function categoryStripItems(list: Category[]) {
      return list.map((c) => ({
        slug: c.slug,
        label: ecosystem!.categoryLabels?.[c.slug] ?? c.label,
        art: c.art,
        image: categoryImages.get(c.slug),
      }));
    }

    // Own-named device lines (iPhone, Galaxy Phones, etc.) up top; everything
    // else in a secondary row. Brands with no categoryLabels entries at all
    // (Huawei, Meta — single-category brands) fall back to one unified strip
    // instead of an empty primary section plus an orphaned "More from" heading.
    const primaryCategories = brandCategories.filter((c) => ecosystem.categoryLabels?.[c.slug]);
    const secondaryCategories = brandCategories.filter((c) => !ecosystem.categoryLabels?.[c.slug]);
    const hasSplit = primaryCategories.length > 1 && secondaryCategories.length > 0;

    const listing = activeCategory ? await getProducts({ searchTerm: query, first: 100 }) : allBrandProducts;

    const flagshipPage = activeCategory
      ? null
      : await getProducts({ searchTerm: ecosystem.query, sortKey: "BEST_SELLING", first: 4 });

    return (
      <div>
        {breadcrumb}

        <div className="mb-10">
          <h1 className="text-title sm:text-display">{ecosystem.label}</h1>
          <p className="mt-2 max-w-2xl text-neutral-500">{ecosystem.blurb}</p>
        </div>

        {hasSplit ? (
          <section aria-label="Shop by category" className="mb-12">
            <IconStrip
              items={[{ slug: "all", label: "All", art: "generic" }, ...categoryStripItems(primaryCategories)]}
              activeSlug={activeCategory?.slug ?? "all"}
              hrefFor={(itemSlug) => buildHref(ecosystem.slug, itemSlug === "all" ? undefined : itemSlug)}
            />
          </section>
        ) : (
          brandCategories.length > 1 && (
            <section aria-label="Shop by category" className="mb-12">
              <IconStrip
                items={[{ slug: "all", label: "All", art: "generic" }, ...categoryStripItems(brandCategories)]}
                activeSlug={activeCategory?.slug ?? "all"}
                hrefFor={(itemSlug) => buildHref(ecosystem.slug, itemSlug === "all" ? undefined : itemSlug)}
              />
            </section>
          )
        )}

        {flagshipPage && flagshipPage.products.length > 0 && (
          <section className="mb-14">
            <SectionHeading eyebrow="Top picks" title="Popular right now" />
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {flagshipPage.products.map((product) => (
                <HeroProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        {hasSplit && secondaryCategories.length > 0 && (
          <section aria-label={`More from ${ecosystem.label}`} className="mb-14">
            <p className="mb-4 text-xs font-medium uppercase tracking-wide text-neutral-400">
              More from {ecosystem.label}
            </p>
            <IconStrip
              items={categoryStripItems(secondaryCategories)}
              activeSlug={activeCategory?.slug}
              hrefFor={(itemSlug) => buildHref(ecosystem.slug, itemSlug)}
            />
          </section>
        )}

        <section className="mb-14 rounded-card bg-neutral-50 px-6 py-10 sm:px-10">
          <SectionHeading eyebrow={`Why shop ${ecosystem.label} with NURU`} title="Genuine stock, real warranty" />
          <div className="mt-8">
            <TrustBadges />
          </div>
        </section>

        <section>
          <SectionHeading
            eyebrow="Full range"
            title={
              activeCategory
                ? `${ecosystem.label} ${ecosystem.categoryLabels?.[activeCategory.slug] ?? activeCategory.label}`
                : `All ${ecosystem.label} products`
            }
          />
          <div className="mt-6">
            <ProductList
              key={query}
              initialProducts={listing.products}
              initialHasNextPage={listing.hasNextPage}
              initialEndCursor={listing.endCursor}
              searchTerm={query}
            />
          </div>
        </section>
      </div>
    );
  }

  const sort = parseSortSlug(sortSlug);

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
      breadcrumb={breadcrumb}
    />
  );
}
