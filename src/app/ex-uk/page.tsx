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
      <div className="flex flex-1 flex-col overflow-hidden">
        <SwipeDeck products={products} />
      </div>
    </>
  );
}
