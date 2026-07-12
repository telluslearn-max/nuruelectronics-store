import type { Metadata } from "next";
import { CollectionTiles } from "@/components/category-tiles";
import { SectionHeading } from "@/components/section-heading";
import { ecosystems } from "@/lib/collections";

export const metadata: Metadata = {
  title: "Shop by Brand",
  description: "Browse NURU's catalog by brand ecosystem.",
  alternates: { canonical: "/ecosystem" },
};

export default function EcosystemIndexPage() {
  const featured = ecosystems.filter((e) => e.featured);
  const rest = ecosystems.filter((e) => !e.featured);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-title sm:text-display">Shop by Brand</h1>
        <p className="mt-2 text-neutral-500">Find everything from your favorite brand in one place.</p>
      </div>

      <CollectionTiles items={featured} basePath="/ecosystem" />

      {rest.length > 0 && (
        <section className="mt-14">
          <SectionHeading eyebrow="More brands" title="All Brands" />
          <div className="mt-6">
            <CollectionTiles items={rest} basePath="/ecosystem" />
          </div>
        </section>
      )}
    </div>
  );
}
