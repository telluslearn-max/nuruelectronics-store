import Link from "next/link";
import type { Collection } from "@/lib/collections";
import { ArtGlyph } from "./product-media";

export function LifestyleTiles({ items, basePath }: { items: Collection[]; basePath: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Link
          key={item.slug}
          href={`${basePath}/${item.slug}`}
          className="group flex flex-col items-start gap-3 rounded-card border border-border-subtle bg-background p-6 transition hover:border-foreground"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10">
            <ArtGlyph kind={item.art} className="h-6 w-6 text-accent" />
          </span>
          <div>
            <h3 className="font-semibold">{item.label}</h3>
            <p className="mt-1 text-sm text-neutral-500">{item.blurb}</p>
          </div>
          <span className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-accent">
            Explore
            <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
              &rarr;
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
