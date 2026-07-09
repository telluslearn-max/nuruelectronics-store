import type { Metadata } from "next";
import { CollectionTiles } from "@/components/category-tiles";
import { ecosystems } from "@/lib/collections";

export const metadata: Metadata = {
  title: "Shop by Brand",
  description: "Browse NURU's catalog by brand ecosystem.",
};

export default function EcosystemIndexPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-title sm:text-3xl">Shop by Brand</h1>
        <p className="mt-2 text-neutral-500">Find everything from your favorite brand in one place.</p>
      </div>
      <CollectionTiles items={ecosystems} basePath="/ecosystem" />
    </div>
  );
}
