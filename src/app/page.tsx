import Link from "next/link";
import { BentoGrid } from "@/components/bento-grid";
import { Faq } from "@/components/faq";
import { ProductMedia } from "@/components/product-media";
import { SectionHeading } from "@/components/section-heading";
import { TrustBadges } from "@/components/trust-badges";
import { categories } from "@/lib/categories";
import { formatPrice } from "@/lib/format";
import { getProducts } from "@/lib/shopify";
import type { Product } from "@/lib/shopify/types";

const phoneGroups = categories.find((c) => c.slug === "phones")?.groups ?? [];

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
        <span className="mt-3 inline-block text-sm font-medium text-accent">
          Buy <span aria-hidden="true">&rarr;</span>
        </span>
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const [flagshipPage, categoryHeroPages] = await Promise.all([
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
  ]);

  const [hero, ...features] = flagshipPage.products;
  const heroPrice = hero?.priceRange.minVariantPrice;

  const bentoCategories = categories.map((category, i) => ({
    slug: category.slug,
    label: category.label,
    blurb: category.blurb,
    art: category.art,
    image: categoryHeroPages[i]?.products[0]?.images[0] ?? null,
  }));

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
                  Buy
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

      <section className="mt-16 border-y border-border-subtle py-10">
        <TrustBadges />
      </section>

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

      {phoneGroups.length > 0 && (
        <section className="mt-16">
          <SectionHeading eyebrow="Quick links" title="Shop phones by brand & series" />
          <div className="mt-6 flex flex-wrap gap-3">
            {phoneGroups.map((group) => (
              <Link
                key={group.slug}
                href={`/category/phones?group=${group.slug}`}
                className="rounded-control border border-border-subtle px-5 py-2.5 text-sm font-medium transition hover:border-foreground"
              >
                {group.label}
              </Link>
            ))}
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
