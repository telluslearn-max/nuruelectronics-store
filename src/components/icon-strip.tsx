import Link from "next/link";
import type { ArtKind } from "@/lib/categories";
import { CarouselShell } from "./carousel-shell";
import { ArtGlyph } from "./product-media";

export function IconStrip({
  items,
  basePath,
}: {
  items: { slug: string; label: string; art: ArtKind }[];
  basePath: string;
}) {
  return (
    <CarouselShell>
      {items.map((item) => (
        <Link
          key={item.slug}
          href={`${basePath}/${item.slug}`}
          className="group flex shrink-0 flex-col items-center gap-2 text-center"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-border-subtle bg-neutral-50 transition group-hover:border-foreground">
            <ArtGlyph
              kind={item.art}
              className="h-8 w-8 text-neutral-500 transition group-hover:text-foreground"
            />
          </span>
          <span className="w-16 text-xs font-medium text-neutral-600">{item.label}</span>
        </Link>
      ))}
    </CarouselShell>
  );
}
