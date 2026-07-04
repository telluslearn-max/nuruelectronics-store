import Link from "next/link";
import { categories } from "@/lib/categories";
import { ArtGlyph } from "./product-media";

export function CategoryTiles() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {categories.map((category) => (
        <Link
          key={category.slug}
          href={`/category/${category.slug}`}
          className="group flex flex-col items-center gap-3 rounded-card border border-border-subtle p-6 text-center transition hover:border-foreground"
        >
          <ArtGlyph
            kind={category.art}
            className="h-14 w-14 text-neutral-400 transition group-hover:text-foreground"
          />
          <span className="text-sm font-medium">{category.label}</span>
        </Link>
      ))}
    </div>
  );
}
