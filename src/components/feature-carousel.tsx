import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/shopify/types";
import { CarouselShell } from "./carousel-shell";

/** Horizontal row of large photo cards for "what's new" style showcases. */
export function FeatureCarousel({ products }: { products: Product[] }) {
  if (products.length === 0) return null;

  return (
    <CarouselShell>
      {products.map((product) => {
        const image = product.images[0];
        const price = product.priceRange.minVariantPrice;
        return (
          <Link
            key={product.id}
            href={`/products/${product.handle}`}
            className="group relative flex h-64 w-56 shrink-0 snap-start flex-col justify-end overflow-hidden rounded-card bg-surface-dark sm:w-64"
          >
            {image && (
              <Image
                src={image.url}
                alt=""
                fill
                sizes="256px"
                className="object-cover transition duration-500 ease-out group-hover:scale-105"
              />
            )}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent"
            />
            <div className="relative p-5 text-surface-dark-foreground">
              <h3 className="text-base font-semibold">{product.title}</h3>
              <p className="mt-1 text-sm text-neutral-300">
                {formatPrice(price.amount, price.currencyCode)}
              </p>
            </div>
          </Link>
        );
      })}
    </CarouselShell>
  );
}
