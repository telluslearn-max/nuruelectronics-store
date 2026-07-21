import type { Metadata } from "next";
import { ExUkTopBar } from "@/components/ex-uk/ex-uk-top-bar";
import { SwipeDeck } from "@/components/ex-uk/swipe-deck";
import { getProducts } from "@/lib/shopify";

export const metadata: Metadata = {
  description:
    "Unboxed ex-UK units at a lower price, every one covered by a 1-year warranty. Swipe right to love, left to pass.",
};

export default async function ExUkPage() {
  const { products } = await getProducts({ searchTerm: "tag:ex-uk", includeSpecs: true, first: 50 });

  return (
    <>
      <ExUkTopBar title="Ex-UK" />
      <div className="flex-1 overflow-y-auto">
        <p className="mx-auto max-w-sm px-4 pt-4 text-center text-sm text-neutral-600">
          Unboxed units imported from the UK, at a lower price — every one covered by a 1-year warranty. Swipe
          right to love it, left to pass.
        </p>
        <SwipeDeck products={products} />
      </div>
    </>
  );
}
