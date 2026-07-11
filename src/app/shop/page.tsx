import type { Metadata } from "next";
import { CollectionTiles } from "@/components/category-tiles";
import { FeatureCarousel } from "@/components/feature-carousel";
import { HelpActions } from "@/components/help-actions";
import { IconStrip } from "@/components/icon-strip";
import { LifestyleTiles } from "@/components/lifestyle-tiles";
import { ProductCarousel } from "@/components/product-carousel";
import { ProductList } from "@/components/product-list";
import { SectionHeading } from "@/components/section-heading";
import { TrustBadges } from "@/components/trust-badges";
import { categories, getCategory } from "@/lib/categories";
import { ecosystems, kits } from "@/lib/collections";
import { getProducts } from "@/lib/shopify";

export const metadata: Metadata = {
  title: "Shop",
  description:
    "Browse the full NURU catalog by category, brand, or need — genuine electronics with fast delivery across Kenya.",
};

const audioCategory = getCategory("audio");
const chargersCategory = getCategory("chargers");

export default async function ShopPage() {
  const [allPage, newPage, audioPage, chargersPage] = await Promise.all([
    getProducts(),
    getProducts({ sortKey: "CREATED_AT", reverse: true, first: 8 }),
    audioCategory
      ? getProducts({ searchTerm: audioCategory.query, sortKey: "BEST_SELLING", first: 8 })
      : Promise.resolve({ products: [], hasNextPage: false, endCursor: null }),
    chargersCategory
      ? getProducts({ searchTerm: chargersCategory.query, sortKey: "BEST_SELLING", first: 8 })
      : Promise.resolve({ products: [], hasNextPage: false, endCursor: null }),
  ]);

  return (
    <div>
      <section className="max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-wide text-accent">NURU Shop</p>
        <h1 className="mt-2 text-title sm:text-display">Everything we sell, organized.</h1>
        <p className="mt-4 text-neutral-500">
          Browse by category, catch what&apos;s new, or jump straight to what you need.
        </p>
      </section>

      <section aria-label="Shop by category" className="mt-10">
        <IconStrip items={categories} basePath="/category" />
      </section>

      <section className="mt-16 rounded-card bg-neutral-50 px-6 py-10 sm:px-10">
        <SectionHeading eyebrow="Get help" title="Not sure where to start?" />
        <div className="mt-8">
          <HelpActions deliveryHref="#delivery" />
        </div>
      </section>

      {newPage.products.length > 0 && (
        <section className="mt-16">
          <SectionHeading eyebrow="Just landed" title="New in stock" />
          <div className="mt-6">
            <FeatureCarousel products={newPage.products} />
          </div>
        </section>
      )}

      <section id="delivery" className="mt-16 scroll-mt-24 border-y border-border-subtle py-10">
        <SectionHeading eyebrow="Why NURU" title="Delivery, warranty & why shop with us" />
        <div className="mt-8">
          <TrustBadges />
        </div>
      </section>

      {audioPage.products.length > 0 && (
        <section className="mt-16">
          <SectionHeading eyebrow="Audio" title="Loud and clear" />
          <div className="mt-6">
            <ProductCarousel products={audioPage.products} />
          </div>
        </section>
      )}

      {chargersPage.products.length > 0 && (
        <section className="mt-16 rounded-card bg-neutral-50 px-6 py-10 sm:px-10">
          <SectionHeading eyebrow="Power & charging" title="Never run flat" />
          <div className="mt-6">
            <ProductCarousel products={chargersPage.products} />
          </div>
        </section>
      )}

      <section className="mt-16">
        <SectionHeading eyebrow="Shop by brand" title="Find your favorite brand" />
        <div className="mt-6">
          <CollectionTiles items={ecosystems} basePath="/ecosystem" />
        </div>
      </section>

      <section className="mt-16 rounded-card bg-neutral-50 px-6 py-10 sm:px-10">
        <SectionHeading
          eyebrow="Shop by need"
          title="Choose tech around how you use it"
          subtitle="Curated picks for what you're actually trying to get done."
        />
        <div className="mt-8">
          <LifestyleTiles items={kits} basePath="/kit" />
        </div>
      </section>

      <section className="mt-16">
        <SectionHeading eyebrow="Full catalog" title="All products" />
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
