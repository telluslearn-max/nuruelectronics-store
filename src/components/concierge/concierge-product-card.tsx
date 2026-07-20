import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/lib/shopify/types";

/**
 * Wraps the storefront's ProductCard with a real "Add to cart" button for the common
 * single-variant case (chargers, cables, earbuds, etc.) — a real tap-to-buy action, not
 * just a description. Multi-variant products fall back to the card's own PDP link, since
 * picking a variant stays a conversational step (the system prompt confirms it first).
 */
export function ConciergeProductCard({ product }: { product: Product }) {
  const singleVariant = product.variants.length === 1;

  return (
    <div>
      <ProductCard product={product} />
      {singleVariant && (
        <div className="mt-2">
          <AddToCartButton variantId={product.variants[0]?.id} availableForSale={product.availableForSale} />
        </div>
      )}
    </div>
  );
}
