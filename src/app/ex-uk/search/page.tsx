import type { Metadata } from "next";
import { ExUkSearchScreen } from "@/components/ex-uk/ex-uk-search-screen";
import { getProducts } from "@/lib/shopify";

export const metadata: Metadata = {
  title: "Search",
};

export default async function ExUkSearchPage() {
  const { products } = await getProducts({
    searchTerm: "tag:ex-uk",
    includeSpecs: true,
    first: 50,
    includeExUk: true,
  });

  return <ExUkSearchScreen products={products} />;
}
