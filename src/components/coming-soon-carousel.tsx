import Link from "next/link";
import { CarouselShell } from "@/components/carousel-shell";
import { NotifyMeButton } from "@/components/notify-me-button";
import { ProductMedia } from "@/components/product-media";
import type { Product } from "@/lib/shopify/types";

function tagline(description: string) {
  const match = description.match(/^.*?[.!?](?:\s|$)/);
  return (match ? match[0] : description).trim();
}

function formatReleaseDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function ComingSoonCarousel({ products }: { products: Product[] }) {
  if (products.length === 0) return null;

  return (
    <CarouselShell>
      {products.map((product) => (
        <div
          key={product.id}
          className="group relative aspect-[3/4] w-72 shrink-0 snap-start overflow-hidden rounded-card bg-surface-dark sm:w-96"
        >
          <Link href={`/products/${product.handle}`} className="absolute inset-0">
            <ProductMedia
              image={product.images[0]}
              title={product.title}
              productType={product.productType}
              sizes="(min-width: 640px) 24rem, 18rem"
              className="object-cover transition duration-300 group-hover:scale-105"
            />
          </Link>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-white">
            <Link href={`/products/${product.handle}`}>
              <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">{product.title}</h3>
              <p className="mt-2 text-sm text-white/80">{tagline(product.description)}</p>
            </Link>
            {product.releaseDate && (
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-white/60">
                Available {formatReleaseDate(product.releaseDate)}
              </p>
            )}
            <div className="relative z-10 mt-4">
              <NotifyMeButton productTitle={product.title} />
            </div>
          </div>
        </div>
      ))}
    </CarouselShell>
  );
}
