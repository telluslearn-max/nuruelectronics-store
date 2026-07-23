import Link from "next/link";
import { calculateBnplPlan, isBnplEligibleProduct } from "@/lib/bnpl";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/shopify/types";
import { ProductMedia } from "./product-media";

export function ProductCard({ product }: { product: Product }) {
  const image = product.images[0];
  const price = product.priceRange.minVariantPrice;
  const bnplPlan = isBnplEligibleProduct(product.tags)
    ? calculateBnplPlan(Number(price.amount), "weekly")
    : null;

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
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{product.title}</h3>
        <div className="shrink-0 text-right">
          <p className="text-sm text-neutral-600">{formatPrice(price.amount, price.currencyCode)}</p>
          {bnplPlan && (
            <p className="text-[11px] text-neutral-400">
              from {formatPrice(String(bnplPlan.installment), price.currencyCode)}/wk
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
