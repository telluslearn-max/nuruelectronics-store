import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Breadcrumb } from "@/components/breadcrumb";
import { IconStrip } from "@/components/icon-strip";
import { ProductList } from "@/components/product-list";
import { SectionHeading } from "@/components/section-heading";
import { TrustBadges } from "@/components/trust-badges";
import { categories, categoryForProductType } from "@/lib/categories";
import { getEcosystem } from "@/lib/collections";
import { formatPrice } from "@/lib/format";
import { getProducts } from "@/lib/shopify";
import type { Product } from "@/lib/shopify/types";

const ecosystem = getEcosystem("apple")!;

type ApplePageProps = {
  searchParams: Promise<{ category?: string }>;
};

function buildHref(category?: string) {
  return category ? `/ecosystem/apple?category=${category}` : "/ecosystem/apple";
}

export async function generateMetadata({ searchParams }: ApplePageProps): Promise<Metadata> {
  const { category } = await searchParams;
  // A category filter is a genuinely different product set, so it gets its
  // own canonical — same rule as /ecosystem/[slug] and /category/[slug].
  const canonical = category ? `/ecosystem/apple?category=${category}` : "/ecosystem/apple";
  return { title: ecosystem.label, description: ecosystem.blurb, alternates: { canonical } };
}

function HeroProductCard({ product }: { product: Product }) {
  const price = product.priceRange.minVariantPrice;
  const image = product.images[0];
  return (
    <Link
      href={`/products/${product.handle}`}
      className="group flex flex-col justify-between overflow-hidden rounded-card border border-border-subtle bg-neutral-50 p-6 transition hover:border-foreground"
    >
      <div>
        <h3 className="text-lg font-medium">{product.title}</h3>
        <p className="mt-1 text-sm text-neutral-500">From {formatPrice(price.amount, price.currencyCode)}</p>
      </div>
      {image && (
        <div className="relative mt-6 aspect-[4/3] w-full">
          <Image
            src={image.url}
            alt={image.altText ?? product.title}
            fill
            className="object-contain transition duration-300 group-hover:scale-105"
            sizes="(min-width: 640px) 45vw, 90vw"
          />
        </div>
      )}
      <span className="mt-6 inline-flex w-fit items-center gap-1 text-sm font-medium text-accent">
        Shop now
      </span>
    </Link>
  );
}

export default async function ApplePage({ searchParams }: ApplePageProps) {
  const { category: categorySlug } = await searchParams;

  // Single fetch covers both the "which categories does Apple stock" check
  // and the default (unfiltered) listing — Apple's whole catalog comfortably
  // fits under 100 products.
  const allBrandProducts = await getProducts({ searchTerm: ecosystem.query, first: 100 });

  const brandCategories = categories.filter((category) =>
    allBrandProducts.products.some((p) => categoryForProductType(p.productType)?.slug === category.slug),
  );
  const activeCategory = brandCategories.find((c) => c.slug === categorySlug);

  const categoryImages = new Map<string, { url: string; altText: string | null }>();
  for (const product of allBrandProducts.products) {
    const slug = categoryForProductType(product.productType)?.slug;
    if (slug && !categoryImages.has(slug) && product.images[0]) {
      categoryImages.set(slug, product.images[0]);
    }
  }

  // Apple's own device lines (iPhone, Mac, Apple Watch, iPad) up top, mirroring
  // how Apple.com/Best Buy structure an Apple brand page; everything else
  // (chargers, accessories, audio, media players) in a secondary row below.
  const primaryCategories = brandCategories.filter((c) => ecosystem.categoryLabels?.[c.slug]);
  const secondaryCategories = brandCategories.filter((c) => !ecosystem.categoryLabels?.[c.slug]);

  const listingQuery = activeCategory ? `(${ecosystem.query}) AND (${activeCategory.query})` : ecosystem.query;
  const listing = activeCategory
    ? await getProducts({ searchTerm: listingQuery, first: 100 })
    : allBrandProducts;

  const flagshipPage = activeCategory
    ? null
    : await getProducts({ searchTerm: ecosystem.query, sortKey: "BEST_SELLING", first: 4 });

  function categoryStripItems(list: typeof brandCategories) {
    return list.map((c) => ({
      slug: c.slug,
      label: ecosystem.categoryLabels?.[c.slug] ?? c.label,
      art: c.art,
      image: categoryImages.get(c.slug),
    }));
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Shop by Brand", href: "/ecosystem" },
          { label: "Apple" },
        ]}
      />

      <div className="mb-10">
        <h1 className="text-title sm:text-display">Apple</h1>
        <p className="mt-2 max-w-2xl text-neutral-500">{ecosystem.blurb}</p>
      </div>

      {primaryCategories.length > 1 && (
        <section aria-label="Shop by category" className="mb-12">
          <IconStrip
            items={[{ slug: "all", label: "All", art: "generic" }, ...categoryStripItems(primaryCategories)]}
            activeSlug={activeCategory?.slug ?? "all"}
            hrefFor={(slug) => buildHref(slug === "all" ? undefined : slug)}
          />
        </section>
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

      {secondaryCategories.length > 0 && (
        <section aria-label="More from Apple" className="mb-14">
          <p className="mb-4 text-xs font-medium uppercase tracking-wide text-neutral-400">More from Apple</p>
          <IconStrip
            items={categoryStripItems(secondaryCategories)}
            activeSlug={activeCategory?.slug}
            hrefFor={(slug) => buildHref(slug)}
          />
        </section>
      )}

      <section className="mb-14 rounded-card bg-neutral-50 px-6 py-10 sm:px-10">
        <SectionHeading eyebrow="Why shop Apple with NURU" title="Genuine stock, real warranty" />
        <div className="mt-8">
          <TrustBadges />
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="Full range"
          title={activeCategory ? `Apple ${ecosystem.categoryLabels?.[activeCategory.slug] ?? activeCategory.label}` : "All Apple products"}
        />
        <div className="mt-6">
          <ProductList
            key={listingQuery}
            initialProducts={listing.products}
            initialHasNextPage={listing.hasNextPage}
            initialEndCursor={listing.endCursor}
            searchTerm={listingQuery}
          />
        </div>
      </section>
    </div>
  );
}
