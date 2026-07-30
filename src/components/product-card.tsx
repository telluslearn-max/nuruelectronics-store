import Link from "next/link";
import { QuickAddToCartButton } from "@/components/cart/quick-add-button";
import { ColorSwatches } from "@/components/color-swatches";
import { CompareToggleButton } from "@/components/compare/compare-toggle-button";
import { gradeForProduct } from "@/components/ex-uk/condition-grade";
import { ProductBadges } from "@/components/product-badges";
import { WishlistToggleButton } from "@/components/wishlist/wishlist-toggle-button";
import { calculateBnplPlan, isBnplEligibleProduct } from "@/lib/bnpl";
import { getProductBadges } from "@/lib/badges";
import { formatPrice } from "@/lib/format";
import { getSavings } from "@/lib/pricing";
import type { Product } from "@/lib/shopify/types";
import { ProductMedia } from "./product-media";

export function ProductCard({ product, quickAdd = false }: { product: Product; quickAdd?: boolean }) {
  const image = product.images[0];
  const price = product.priceRange.minVariantPrice;
  const compareAtPrice = product.compareAtPriceRange?.minVariantPrice;
  const savings = getSavings(price, compareAtPrice);
  const grade = gradeForProduct(product.tags);
  const cheapestVariant = product.variants.find((v) => v.price.amount === price.amount);
  const bnplPlan = isBnplEligibleProduct(product.tags)
    ? calculateBnplPlan(
        Number(price.amount),
        "weekly",
        cheapestVariant?.bnplPrice ? Number(cheapestVariant.bnplPrice.amount) : undefined,
      )
    : null;
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
        <ProductBadges
          variant="card"
          badges={getProductBadges({
            tags: product.tags,
            availableForSale: product.availableForSale,
            price,
            compareAtPrice,
            variant: "card",
          })}
        />
        <div className="absolute right-3 top-3 flex flex-col gap-2">
          <WishlistToggleButton product={product} />
          <CompareToggleButton product={product} />
        </div>
      </div>
      <div className="mt-3 space-y-1">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug">{product.title}</h3>
        {grade && <p className="text-xs text-neutral-500">{grade.label}</p>}
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 pt-0.5">
          <span className="text-sm font-semibold">{formatPrice(price.amount, price.currencyCode)}</span>
          {savings && compareAtPrice && (
            <>
              <span className="text-xs text-neutral-400 line-through">
                {formatPrice(compareAtPrice.amount, compareAtPrice.currencyCode)}
              </span>
              <span className="rounded-control bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                Save {formatPrice(savings.save.amount, savings.save.currencyCode)}
              </span>
            </>
          )}
        </div>
        {bnplPlan && (
          <p className="text-[11px] text-neutral-400">
            from {formatPrice(String(bnplPlan.installment), price.currencyCode)}/wk
          </p>
        )}
        {quickAdd && <QuickAddToCartButton product={product} className="mt-2" />}
      </div>
      {colorOption && colorOption.values.length > 0 && <ColorSwatches values={colorOption.values} />}
    </Link>
  );
}
