import Image from "next/image";
import Link from "next/link";
import type { ArtKind } from "@/lib/categories";
import type { ProductImage } from "@/lib/shopify/types";
import { ArtGlyph } from "./product-media";

export type BentoItem = {
  slug: string;
  label: string;
  blurb: string;
  art: ArtKind;
  /** Representative product photo for this tile. Falls back to a glyph when absent. */
  image?: ProductImage | null;
};

/**
 * Category showcase grid: an editorial index, not a dashboard of feature
 * tiles — each entry numbered like a table of contents, and a product photo
 * grounded directly on the surface rather than floating over a glow. Text
 * always sits on plain background, so legibility never depends on the photo
 * underneath it.
 */
export function BentoGrid({ items, basePath }: { items: BentoItem[]; basePath: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, index) => (
        <Link
          key={item.slug}
          href={`${basePath}/${item.slug}`}
          className="group relative flex min-h-[14rem] flex-col justify-between rounded-card border border-border-subtle bg-background p-6 transition hover:border-foreground"
        >
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="max-w-[68%]">
              <p className="text-eyebrow font-mono text-neutral-400">{String(index + 1).padStart(2, "0")}</p>
              <h3 className="mt-2 text-xl font-bold tracking-tight">{item.label}</h3>
              <p className="mt-1.5 text-sm text-neutral-500">{item.blurb}</p>
            </div>
          </div>

          <div className="relative z-10 mt-4 flex items-end justify-between gap-3">
            <span className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-accent">
              Shop now
              <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
                &rarr;
              </span>
            </span>
            <div className="h-16 w-16 shrink-0 transition duration-300 ease-out group-hover:-translate-y-0.5">
              {item.image ? (
                <Image
                  src={item.image.url}
                  alt=""
                  width={64}
                  height={64}
                  sizes="64px"
                  className="h-full w-full object-contain"
                />
              ) : (
                <ArtGlyph kind={item.art} className="h-full w-full text-neutral-300" />
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
