import Link from "next/link";
import { QuickAddToCartButton } from "@/components/cart/quick-add-button";
import { ProductMedia } from "@/components/product-media";
import { formatPrice } from "@/lib/format";
import { getSavings } from "@/lib/pricing";
import type { Product } from "@/lib/shopify/types";

/**
 * Compact single-column-width card for the concierge's product carousel —
 * a stripped-down ProductCard (no wishlist/compare/swatches/BNPL chrome)
 * that only shows fields the product data actually has.
 */
export function ConciergeCarouselCard({ product }: { product: Product }) {
  const image = product.images[0];
  const price = product.priceRange.minVariantPrice;
  const compareAtPrice = product.compareAtPriceRange?.minVariantPrice;
  const savings = getSavings(price, compareAtPrice);
  const singleVariant = product.variants.length === 1;

  return (
    <Link href={`/products/${product.handle}`} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-card bg-neutral-100">
        <ProductMedia
          image={image}
          title={product.title}
          productType={product.productType}
          sizes="192px"
          className="object-cover transition duration-300 group-hover:scale-105"
        />
      </div>
      <div className="mt-2 space-y-1">
        <h3 className="line-clamp-2 text-xs font-medium leading-snug">{product.title}</h3>
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="text-sm font-semibold">{formatPrice(price.amount, price.currencyCode)}</span>
          {savings && compareAtPrice && (
            <span className="text-[11px] text-neutral-400 line-through">
              {formatPrice(compareAtPrice.amount, compareAtPrice.currencyCode)}
            </span>
          )}
        </div>
        {!product.availableForSale ? (
          <p className="text-[11px] text-neutral-400">Sold out</p>
        ) : (
          singleVariant && <QuickAddToCartButton product={product} className="mt-1" />
        )}
      </div>
    </Link>
  );
}
