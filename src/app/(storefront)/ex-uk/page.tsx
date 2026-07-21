import type { Metadata } from "next";
import { SwipeDeck } from "@/components/ex-uk/swipe-deck";
import { getProducts } from "@/lib/shopify";

export const metadata: Metadata = {
  title: "Ex-UK",
  description:
    "Unboxed ex-UK units at a lower price, every one covered by a 1-year warranty. Swipe right to love, left to pass.",
};

export default async function ExUkPage() {
  const { products } = await getProducts({ searchTerm: "tag:ex-uk", includeSpecs: true, first: 50 });

  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 pt-8 text-center">
        <h1 className="text-title">Ex-UK</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
          Unboxed units imported from the UK, at a lower price — every one covered by a 1-year warranty. Swipe
          right to love it, left to pass.
        </p>
      </div>
      <SwipeDeck products={products} />
    </div>
  );
}
