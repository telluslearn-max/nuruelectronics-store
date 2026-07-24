import Link from "next/link";
import { ColorSwatches } from "@/components/color-swatches";
import { CompareToggleButton } from "@/components/compare/compare-toggle-button";
import { WishlistToggleButton } from "@/components/wishlist/wishlist-toggle-button";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/shopify/types";
import { ProductMedia } from "./product-media";

export function ProductCard({ product }: { product: Product }) {
  const image = product.images[0];
  const price = product.priceRange.minVariantPrice;
  const colorOption = product.options.find((o) => o.name === "Color");

  return (
    <Link href={`/products/${product.handle}`} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-card bg-neutral-100 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-lg">
        <ProductMedia
          image={image}
          title={product.title}
          productType={product.productType}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover transition duration-300 group-hover:scale-105"
        />
        {!product.availableForSale && (
          <span className="absolute left-3 top-3 rounded-control bg-background px-2.5 py-1 text-xs font-medium text-neutral-600">
            Sold out
          </span>
        )}
        <div className="absolute right-3 top-3 flex flex-col gap-2">
          <WishlistToggleButton product={product} />
          <CompareToggleButton product={product} />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{product.title}</h3>
        <p className="shrink-0 text-sm text-neutral-600">
          {formatPrice(price.amount, price.currencyCode)}
        </p>
      </div>
      {colorOption && colorOption.values.length > 0 && <ColorSwatches values={colorOption.values} />}
    </Link>
  );
}
