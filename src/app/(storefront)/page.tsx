import Link from "next/link";
import { BentoGrid } from "@/components/bento-grid";
import { ComingSoonCarousel } from "@/components/coming-soon-carousel";
import { Faq } from "@/components/faq";
import { HomeRecommendations } from "@/components/home-recommendations";
import { ProductCarousel } from "@/components/product-carousel";
import { ProductMedia } from "@/components/product-media";
import { SectionHeading } from "@/components/section-heading";
import { TrustBadges } from "@/components/trust-badges";
import { categories } from "@/lib/categories";
import { formatPrice } from "@/lib/format";
import { getComingSoonProducts, getProducts } from "@/lib/shopify";
import type { Product } from "@/lib/shopify/types";

// The low-commitment first purchase — cables, cases, power banks — pulled
// from the two categories where sub-5K items actually live in this catalog.
// Deliberately not its own route: it's a Home rail sourced from existing
// category queries, filtered by price, rather than new IA.
const BUDGET_PRICE_LIMIT_KES = 5000;
const BUDGET_SOURCE_SLUGS = ["accessories", "chargers"];

// Hand-picked, cross-category — not just phones. Pulled from groups that
// already exist in the catalog taxonomy, several called out in categories.ts
// as the dominant vendor in their category (Razer, DJI, Vision Plus, Anker).
const POPULAR_COLLECTIONS: { categorySlug: string; groupSlug: string }[] = [
  { categorySlug: "phones", groupSlug: "foldables" },
  { categorySlug: "phones", groupSlug: "s26" },
  { categorySlug: "phones", groupSlug: "iphone-17" },
  { categorySlug: "gaming", groupSlug: "razer" },
  { categorySlug: "cameras", groupSlug: "dji" },
  { categorySlug: "audio", groupSlug: "jbl" },
  { categorySlug: "chargers", groupSlug: "anker" },
  { categorySlug: "appliances", groupSlug: "vision-plus" },
];

const popularCollectionGroups = POPULAR_COLLECTIONS.map(({ categorySlug, groupSlug }) => {
  const category = categories.find((c) => c.slug === categorySlug);
  const group = category?.groups?.find((g) => g.slug === groupSlug);
  return group ? { href: `/category/${categorySlug}?group=${groupSlug}`, label: group.label, query: group.query } : undefined;
}).filter((entry): entry is { href: string; label: string; query: string } => entry !== undefined);

function firstSentence(text: string) {
  const match = text.match(/^.*?[.!?](?:\s|$)/);
  return (match ? match[0] : text).trim();
}

function FeatureCard({ product }: { product: Product }) {
  const price = product.priceRange.minVariantPrice;
  return (
    <Link
      href={`/products/${product.handle}`}
      className="group flex items-center gap-6 rounded-card border border-border-subtle p-6 transition hover:border-foreground"
    >
      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
        <ProductMedia
          image={product.images[0]}
          title={product.title}
          productType={product.productType}
          sizes="112px"
        />
      </div>
      <div>
        <h3 className="font-medium">{product.title}</h3>
        <p className="mt-1 text-sm text-neutral-500">
          {formatPrice(price.amount, price.currencyCode)}
        </p>
        <span className="mt-3 inline-block text-sm font-medium text-accent">Shop now</span>
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const budgetSourceCategories = BUDGET_SOURCE_SLUGS.map((slug) =>
    categories.find((c) => c.slug === slug),
  ).filter((c): c is (typeof categories)[number] => c !== undefined);

  const [
    flagshipPage,
    categoryHeroPages,
    comingSoonProducts,
    bestSellersPage,
    newArrivalsPage,
    popularCollectionPages,
    budgetSourcePages,
  ] = await Promise.all([
    getProducts({
      searchTerm: "product_type:Smartphones",
      sortKey: "PRICE",
      reverse: true,
      first: 3,
    }),
    Promise.all(
      categories.map((category) =>
        getProducts({ searchTerm: category.query, sortKey: "BEST_SELLING", first: 1 }),
      ),
    ),
    getComingSoonProducts(),
    getProducts({ sortKey: "BEST_SELLING", first: 12 }),
    getProducts({ sortKey: "CREATED_AT", reverse: true, first: 12 }),
    Promise.all(
      popularCollectionGroups.map((group) => getProducts({ searchTerm: group.query, first: 8 })),
    ),
    Promise.all(
      budgetSourceCategories.map((category) =>
        getProducts({ searchTerm: category.query, sortKey: "BEST_SELLING", first: 24 }),
      ),
    ),
  ]);

  const seenBudgetIds = new Set<string>();
  const budgetProducts = budgetSourcePages
    .flatMap((page) => page.products)
    .filter((product) => {
      if (seenBudgetIds.has(product.id)) return false;
      if (Number(product.priceRange.minVariantPrice.amount) > BUDGET_PRICE_LIMIT_KES) return false;
      seenBudgetIds.add(product.id);
      return true;
    })
    .slice(0, 12);

  const [hero, ...features] = flagshipPage.products;
  const heroPrice = hero?.priceRange.minVariantPrice;

  const bentoCategories = categories.map((category, i) => ({
    slug: category.slug,
    label: category.label,
    blurb: category.blurb,
    art: category.art,
    image: categoryHeroPages[i]?.products[0]?.images[0] ?? null,
  }));

  const popularCollections = popularCollectionGroups
    .map((group, i) => ({ ...group, products: popularCollectionPages[i]?.products ?? [] }))
    .filter((collection) => collection.products.length > 0);

  return (
    <div>
      {hero && (
        <section className="animate-fade-up overflow-hidden rounded-card bg-surface-dark text-surface-dark-foreground">
          <div className="grid grid-cols-1 items-center gap-8 p-8 sm:p-12 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-accent">
                Genuine electronics. Delivered fast.
              </p>
              <h1 className="mt-2 text-title sm:text-display">{hero.title}</h1>
              <p className="mt-4 max-w-md text-neutral-400">{firstSentence(hero.description)}</p>
              {heroPrice && (
                <p className="mt-4 text-lg font-medium">
                  From {formatPrice(heroPrice.amount, heroPrice.currencyCode)}
                </p>
              )}
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={`/products/${hero.handle}`}
                  className="rounded-control bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition hover:opacity-90"
                >
                  Shop now
                </Link>
                <Link
                  href="/category/phones"
                  className="rounded-control border border-neutral-600 px-6 py-3 text-sm font-medium transition hover:border-neutral-300"
                >
                  Explore phones
                </Link>
              </div>
            </div>
            <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-lg">
              <ProductMedia
                image={hero.images[0]}
                title={hero.title}
                productType={hero.productType}
                sizes="(min-width: 768px) 24rem, 100vw"
                priority
              />
            </div>
          </div>
        </section>
      )}

      {features.length > 0 && (
        <section aria-label="Featured products" className="mt-6 grid gap-6 md:grid-cols-2">
          {features.map((product) => (
            <FeatureCard key={product.id} product={product} />
          ))}
        </section>
      )}

      {bestSellersPage.products.length > 0 && (
        <section className="mt-16">
          <SectionHeading eyebrow="Trending now" title="Best sellers" subtitle="What NURU shoppers are buying most." />
          <div className="mt-6">
            <ProductCarousel products={bestSellersPage.products} />
          </div>
        </section>
      )}

      <section className="mt-16 border-y border-border-subtle py-10">
        <TrustBadges />
      </section>

      {newArrivalsPage.products.length > 0 && (
        <section className="mt-16">
          <SectionHeading eyebrow="Just landed" title="New arrivals" subtitle="The newest additions to the NURU catalog." />
          <div className="mt-6">
            <ProductCarousel products={newArrivalsPage.products} />
          </div>
        </section>
      )}

      {budgetProducts.length > 0 && (
        <section className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              eyebrow="Low commitment, high utility"
              title="Accessories under KSh 5,000"
              subtitle="Cables, cases, and power banks — an easy first order while you decide on the big one."
            />
            <Link href="/category/accessories" className="text-sm font-medium text-accent hover:opacity-80">
              See all
            </Link>
          </div>
          <div className="mt-6">
            <ProductCarousel products={budgetProducts} />
          </div>
        </section>
      )}

      <HomeRecommendations />

      <section className="mt-16">
        <SectionHeading
          eyebrow="Shop by category"
          title="Ten categories. One place to shop."
          subtitle="From flagship phones to the small stuff that keeps them charged — browse everything NURU stocks."
        />
        <div className="mt-6">
          <BentoGrid items={bentoCategories} basePath="/category" />
        </div>
      </section>

      {popularCollections.length > 0 && (
        <section className="mt-16">
          <SectionHeading eyebrow="Quick discovery" title="Popular collections right now" />
          <div className="mt-8 space-y-10">
            {popularCollections.map((collection) => (
              <div key={collection.href}>
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-medium">{collection.label}</h3>
                  <Link href={collection.href} className="text-sm font-medium text-accent hover:opacity-80">
                    See all
                  </Link>
                </div>
                <div className="mt-4">
                  <ProductCarousel products={collection.products} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {comingSoonProducts.length > 0 && (
        <section className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              eyebrow="Confirmed. Not yet released."
              title="Coming soon"
              subtitle="Phones and electronics landing at NURU with a confirmed release date."
            />
            <Link href="/coming-soon" className="text-sm font-medium text-accent hover:opacity-80">
              See all
            </Link>
          </div>
          <div className="mt-6">
            <ComingSoonCarousel products={comingSoonProducts} />
          </div>
        </section>
      )}

      <section className="mt-16 flex flex-col items-start gap-4 rounded-card border border-border-subtle p-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Want the full picture?</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Browse every brand, every use case, and the entire catalog in one place.
          </p>
        </div>
        <Link
          href="/shop"
          className="shrink-0 rounded-control bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
        >
          Explore the full shop
        </Link>
      </section>

      <section className="mt-16">
        <SectionHeading eyebrow="Questions" title="Common questions" />
        <div className="mt-6">
          <Faq />
        </div>
      </section>
    </div>
  );
}
