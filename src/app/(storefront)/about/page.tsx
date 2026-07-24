import type { Metadata } from "next";
import Link from "next/link";
import { TrustBadges } from "@/components/trust-badges";
import { ArtGlyph } from "@/components/product-media";
import { categories } from "@/lib/categories";

export const metadata: Metadata = {
  title: "About",
  description: "NURU is a Kenya-based electronics store offering genuine phones, laptops, audio, gaming, cameras, appliances, and more.",
};

export default function AboutPage() {
  return (
    <div>
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-medium text-accent">Genuine electronics. Delivered fast.</p>
        <h1 className="mt-2 text-title sm:text-display">About NURU</h1>
        <p className="mt-4 text-neutral-500">
          NURU is a Kenya-based electronics store offering genuine phones, laptops, audio, gaming,
          cameras, appliances, and more from the world&apos;s top brands. Every order ships with
          manufacturer warranty and fast delivery across Kenya.
        </p>
      </div>

      <div className="mx-auto mt-16 max-w-4xl">
        <TrustBadges />
      </div>

      <div className="mx-auto mt-16 max-w-4xl">
        <h2 className="text-center text-title">What we sell</h2>
        <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/category/${category.slug}`}
              className="group flex flex-col items-center gap-2 text-center"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-border-subtle bg-neutral-50 transition group-hover:border-foreground">
                <ArtGlyph
                  kind={category.art}
                  className="h-8 w-8 text-neutral-500 transition group-hover:text-foreground"
                />
              </span>
              <span className="text-sm font-medium">{category.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
