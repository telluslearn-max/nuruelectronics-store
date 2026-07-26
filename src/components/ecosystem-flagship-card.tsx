import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/shopify/types";

/** Only used by ecosystem/[slug]/page.tsx's "Top picks" rail on featured-brand hub pages —
    not a general-purpose homepage hero, despite the name this used to have. */
export function EcosystemFlagshipCard({ product }: { product: Product }) {
  const price = product.priceRange.minVariantPrice;
  const image = product.images[0];
  return (
    <Link
      href={`/products/${product.handle}`}
      className="group flex flex-col justify-between overflow-hidden rounded-card border border-border-subtle bg-neutral-50 p-6 transition hover:border-foreground"
    >
      <div>
        <h3 className="text-lg font-medium">{product.title}</h3>
        <p className="mt-1 text-sm text-neutral-500">From {formatPrice(price.amount, price.currencyCode)}</p>
      </div>
      {image && (
        <div className="relative mt-6 aspect-[4/3] w-full">
          <Image
            src={image.url}
            alt={image.altText ?? product.title}
            fill
            className="object-contain transition duration-300 group-hover:scale-105"
            sizes="(min-width: 640px) 45vw, 90vw"
          />
        </div>
      )}
      <span className="mt-6 inline-flex w-fit items-center gap-1 text-sm font-medium text-accent">
        Shop now
      </span>
    </Link>
  );
}
