import Link from "next/link";
import { QuickAddToCartButton } from "@/components/cart/quick-add-button";
import { ProductMedia } from "@/components/product-media";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/shopify/types";

/**
 * Compact horizontal card for the concierge panel's narrow (~320-384px) width — the storefront's
 * grid ProductCard (square image, badges, color swatches, wishlist/compare buttons) is built for
 * wide catalog grids and doesn't fit a chat column. Multi-variant products link to the PDP to pick
 * a variant (the system prompt already confirms that conversationally); single-variant, in-stock
 * products get a real tap-to-buy button.
 */
export function ConciergeProductCard({ product }: { product: Product }) {
  const price = product.priceRange.minVariantPrice;
  const singleVariant = product.variants.length === 1 ? product.variants[0] : undefined;
  const canQuickAdd = Boolean(singleVariant && product.availableForSale && singleVariant.availableForSale);

  return (
    <div className="flex items-center gap-3 rounded-card border border-border-subtle p-2">
      <Link
        href={`/products/${product.handle}`}
        className="relative h-14 w-14 shrink-0 overflow-hidden rounded-control bg-neutral-100"
      >
        <ProductMedia image={product.images[0]} title={product.title} productType={product.productType} sizes="56px" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/products/${product.handle}`} className="block truncate text-sm font-medium hover:underline">
          {product.title}
        </Link>
        <p className="text-sm text-neutral-600">{formatPrice(price.amount, price.currencyCode)}</p>
      </div>
      <div className="w-24 shrink-0">
        {canQuickAdd ? (
          <QuickAddToCartButton product={product} />
        ) : (
          <Link
            href={`/products/${product.handle}`}
            className="block w-full rounded-control border border-border-subtle py-2 text-center text-xs font-medium transition hover:border-foreground"
          >
            View
          </Link>
        )}
      </div>
    </div>
  );
}
