import Link from "next/link";
import { ArtGlyph } from "./product-media";

/**
 * Shared tile-grid nav for the Gaming category's "Games" group facets
 * (genre, editorial collection). Links via query params rather than path
 * segments, so it can't reuse the plain `CollectionTiles`.
 */
export function FilterTiles({
  items,
  activeSlug,
  hrefFor,
  allLabel,
}: {
  items: { slug: string; label: string }[];
  activeSlug?: string;
  hrefFor: (slug?: string) => string;
  allLabel: string;
}) {
  return (
    <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <Link
        href={hrefFor(undefined)}
        className={`group flex flex-col items-center gap-3 rounded-card border p-6 text-center transition ${
          !activeSlug ? "border-foreground" : "border-border-subtle hover:border-foreground"
        }`}
      >
        <ArtGlyph
          kind="gaming"
          className={`h-14 w-14 transition ${
            !activeSlug ? "text-foreground" : "text-neutral-400 group-hover:text-foreground"
          }`}
        />
        <p className="text-sm font-medium">{allLabel}</p>
      </Link>
      {items.map((item) => {
        const isActive = activeSlug === item.slug;
        return (
          <Link
            key={item.slug}
            href={hrefFor(item.slug)}
            className={`group flex flex-col items-center gap-3 rounded-card border p-6 text-center transition ${
              isActive ? "border-foreground" : "border-border-subtle hover:border-foreground"
            }`}
          >
            <ArtGlyph
              kind="gaming"
              className={`h-14 w-14 transition ${
                isActive ? "text-foreground" : "text-neutral-400 group-hover:text-foreground"
              }`}
            />
            <p className="text-sm font-medium">{item.label}</p>
          </Link>
        );
      })}
    </div>
  );
}
