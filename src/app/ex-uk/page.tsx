import type { Metadata } from "next";
import { Suspense } from "react";
import { ExUkDiscoverScreen } from "@/components/ex-uk/ex-uk-discover-screen";
import { computeSavings, findCounterpart, type Savings } from "@/lib/product-match";
import { getProducts } from "@/lib/shopify";

export const metadata: Metadata = {
  description:
    "Unboxed ex-UK units at a lower price, every one covered by a 1-year warranty. Swipe right to love, left to pass.",
};

export default async function ExUkPage() {
  const { products } = await getProducts({
    searchTerm: "tag:ex-uk",
    includeSpecs: true,
    first: 50,
    includeExUk: true,
  });

  const savingsEntries = await Promise.all(
    products.map(async (product) => {
      const counterpart = await findCounterpart(product, { requireExUk: false });
      if (!counterpart) return null;
      const savings = computeSavings(
        product.priceRange.minVariantPrice.amount,
        counterpart.priceRange.minVariantPrice.amount,
        product.priceRange.minVariantPrice.currencyCode,
      );
      return savings ? ([product.handle, savings] as const) : null;
    }),
  );
  const savingsByHandle: Record<string, Savings> = Object.fromEntries(
    savingsEntries.filter((entry): entry is readonly [string, Savings] => entry !== null),
  );

  return (
    <Suspense>
      <ExUkDiscoverScreen products={products} savingsByHandle={savingsByHandle} />
    </Suspense>
  );
}
