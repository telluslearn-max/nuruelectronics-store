import Link from "next/link";
import { ProductList } from "@/components/product-list";
import { ProductMedia, ArtGlyph } from "@/components/product-media";
import { categories } from "@/lib/categories";
import { formatPrice } from "@/lib/format";
import { getProducts } from "@/lib/shopify";
import type { Product } from "@/lib/shopify/types";

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
  const [flagshipPage, allPage] = await Promise.all([
    getProducts({
      searchTerm: "product_type:Smartphones",
      sortKey: "PRICE",
      reverse: true,
      first: 3,
    }),
    getProducts(),
  ]);

  const [hero, ...features] = flagshipPage.products;
  const heroPrice = hero?.priceRange.minVariantPrice;

  return (
    <div>
      {hero && (
        <section className="animate-fade-up overflow-hidden rounded-card bg-surface-dark text-surface-dark-foreground">
          <div className="grid grid-cols-1 items-center gap-8 p-8 sm:p-12 md:grid-cols-2">
            <div>
              <h1 className="text-title sm:text-display">{hero.title}</h1>
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

      <section className="mt-16">
        <h2 className="text-title">Shop by category</h2>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/category/${category.slug}`}
              className="group flex flex-col items-center gap-3 rounded-card border border-border-subtle p-6 text-center transition hover:border-foreground"
            >
              <ArtGlyph
                kind={category.art}
                className="h-14 w-14 text-neutral-400 transition group-hover:text-foreground"
              />
              <span className="text-sm font-medium">{category.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-title">All products</h2>
        <div className="mt-6">
          <ProductList
            initialProducts={allPage.products}
            initialHasNextPage={allPage.hasNextPage}
            initialEndCursor={allPage.endCursor}
          />
        </div>
      </section>
    </div>
  );
}
