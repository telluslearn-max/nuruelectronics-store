import type { Metadata } from "next";
import { CollectionTiles } from "@/components/category-tiles";
import { kits } from "@/lib/collections";

export const metadata: Metadata = {
  title: "Shop by Need",
  description: "Curated bundles from NURU for every use case.",
};

export default function KitIndexPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-title sm:text-3xl">Shop by Need</h1>
        <p className="mt-2 text-neutral-500">Curated picks for what you're trying to get done.</p>
      </div>
      <CollectionTiles items={kits} basePath="/kit" />
    </div>
  );
}
