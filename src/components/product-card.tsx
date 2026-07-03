import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/shopify/types";

function formatPrice(amount: string, currencyCode: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(
    Number(amount),
  );
}

export function ProductCard({ product }: { product: Product }) {
  const image = product.images[0];
  const price = product.priceRange.minVariantPrice;

  return (
    <Link href={`/products/${product.handle}`} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-neutral-100">
        {image && (
          <Image
            src={image.url}
            alt={image.altText ?? product.title}
            fill
            className="object-cover transition duration-300 group-hover:scale-105"
            sizes="(min-width: 768px) 25vw, 50vw"
          />
        )}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">{product.title}</h3>
        <p className="text-sm text-neutral-600">{formatPrice(price.amount, price.currencyCode)}</p>
      </div>
    </Link>
  );
}
