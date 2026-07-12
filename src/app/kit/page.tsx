import type { Metadata } from "next";
import Link from "next/link";
import { CollectionTiles } from "@/components/category-tiles";
import { ProductCarousel } from "@/components/product-carousel";
import { kits } from "@/lib/collections";
import { getProducts } from "@/lib/shopify";

export const metadata: Metadata = {
  title: "Shop by Need",
  description: "Curated bundles from NURU for every use case.",
  alternates: { canonical: "/kit" },
};

export default async function KitIndexPage() {
  const kitPages = await Promise.all(
    kits.map((kit) => getProducts({ searchTerm: kit.query, sortKey: "BEST_SELLING", first: 8 })),
  );

  const kitsWithProducts = kits
    .map((kit, i) => ({ ...kit, products: kitPages[i]?.products ?? [] }))
    .filter((kit) => kit.products.length > 0);

  return (
    <div>
      <div className="mb-12 max-w-2xl">
        <h1 className="text-title sm:text-display">Shop by Need</h1>
        <p className="mt-2 text-neutral-500">
          Curated picks for what you&apos;re trying to get done — browse each bundle or shop it in
          full.
        </p>
      </div>

      {kitsWithProducts.length > 0 ? (
        <div className="space-y-16">
          {kitsWithProducts.map((kit) => (
            <section key={kit.slug}>
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <div>
                  <h2 className="text-title">{kit.label}</h2>
                  <p className="mt-1 text-sm text-neutral-500">{kit.blurb}</p>
                </div>
                <Link
                  href={`/kit/${kit.slug}`}
                  className="shrink-0 text-sm font-medium text-accent hover:opacity-80"
                >
                  Shop {kit.label}
                </Link>
              </div>
              <ProductCarousel products={kit.products} />
            </section>
          ))}
        </div>
      ) : (
        // Falls back to plain tiles if no products are tagged for any kit yet —
        // keeps the page navigable instead of rendering an empty shell.
        <CollectionTiles items={kits} basePath="/kit" />
      )}
    </div>
  );
}
