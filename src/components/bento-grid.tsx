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
 * Category showcase grid: uniform white cards, a soft color blob, and a
 * product photo tucked in the corner rather than filling the tile. Text
 * always sits on plain background, so legibility never depends on the
 * photo underneath it.
 */
export function BentoGrid({ items, basePath }: { items: BentoItem[]; basePath: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Link
          key={item.slug}
          href={`${basePath}/${item.slug}`}
          className="group relative flex min-h-[13.5rem] flex-col justify-between overflow-hidden rounded-card border border-border-subtle bg-background p-6 transition hover:border-foreground"
        >
          <div className="relative z-10 max-w-[70%] sm:max-w-[62%]">
            <h3 className="text-base font-semibold">{item.label}</h3>
            <p className="mt-1.5 text-sm text-neutral-500">{item.blurb}</p>
          </div>

          <span className="relative z-10 mt-4 inline-flex w-fit items-center gap-1 text-sm font-medium text-accent">
            Shop now
          </span>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-accent/10 blur-md"
          />
          <div className="pointer-events-none absolute bottom-2 right-2 h-28 w-28 transition duration-500 ease-out group-hover:-translate-y-1 group-hover:scale-105">
            {item.image ? (
              <Image
                src={item.image.url}
                alt=""
                fill
                sizes="112px"
                className="object-contain drop-shadow-md"
              />
            ) : (
              <ArtGlyph kind={item.art} className="h-full w-full text-neutral-300" />
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
