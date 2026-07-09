import Link from "next/link";
import type { ArtKind } from "@/lib/categories";
import { categories } from "@/lib/categories";
import { ArtGlyph } from "./product-media";

export function CollectionTiles({
  items,
  basePath,
}: {
  items: { slug: string; label: string; blurb: string; art: ArtKind }[];
  basePath: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <Link
          key={item.slug}
          href={`${basePath}/${item.slug}`}
          className="group flex flex-col items-center gap-3 rounded-card border border-border-subtle p-6 text-center transition hover:border-foreground"
        >
          <ArtGlyph
            kind={item.art}
            className="h-14 w-14 text-neutral-400 transition group-hover:text-foreground"
          />
          <div>
            <p className="text-sm font-medium">{item.label}</p>
            <p className="mt-1 text-xs text-neutral-500">{item.blurb}</p>
          </div>
          <span className="text-xs font-medium text-accent">
            Shop now <span aria-hidden="true">&rarr;</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

export function CategoryTiles() {
  return <CollectionTiles items={categories} basePath="/category" />;
}
