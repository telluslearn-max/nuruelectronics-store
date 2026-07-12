import Image from "next/image";
import Link from "next/link";
import type { ArtKind } from "@/lib/categories";
import { CarouselShell } from "./carousel-shell";
import { ArtGlyph } from "./product-media";

type IconStripItem = {
  slug: string;
  label: string;
  art: ArtKind;
  /** A representative product photo. Falls back to the abstract ArtGlyph when absent. */
  image?: { url: string; altText: string | null } | null;
};

type IconStripBase = {
  items: IconStripItem[];
  /** Highlights the matching item, e.g. the category currently filtering a listing. */
  activeSlug?: string;
};

type IconStripProps =
  | (IconStripBase & { basePath: string; hrefFor?: undefined })
  | (IconStripBase & { basePath?: undefined; hrefFor: (slug: string) => string });

export function IconStrip({ items, basePath, hrefFor, activeSlug }: IconStripProps) {
  return (
    <CarouselShell>
      {items.map((item) => {
        const isActive = activeSlug === item.slug;
        const href = hrefFor ? hrefFor(item.slug) : `${basePath}/${item.slug}`;
        return (
          <Link
            key={item.slug}
            href={href}
            aria-current={isActive ? "true" : undefined}
            className="group flex shrink-0 snap-start flex-col items-center gap-2 text-center"
          >
            <span
              className={`relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border bg-neutral-50 transition group-hover:border-foreground ${
                isActive ? "border-foreground ring-2 ring-foreground ring-offset-2" : "border-border-subtle"
              }`}
            >
              {item.image ? (
                <Image
                  src={item.image.url}
                  alt={item.image.altText ?? item.label}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : (
                <ArtGlyph
                  kind={item.art}
                  className={`h-8 w-8 transition group-hover:text-foreground ${
                    isActive ? "text-foreground" : "text-neutral-500"
                  }`}
                />
              )}
            </span>
            <span
              className={`w-16 text-xs font-medium ${isActive ? "text-foreground" : "text-neutral-600"}`}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </CarouselShell>
  );
}
