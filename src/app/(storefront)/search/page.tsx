import type { Metadata } from "next";
import { CategoryTiles } from "@/components/category-tiles";
import { ProductList } from "@/components/product-list";
import { getProducts } from "@/lib/shopify";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `Search results for "${q}"` : "Search",
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const { products, hasNextPage, endCursor } = query
    ? await getProducts({ searchTerm: query })
    : { products: [], hasNextPage: false, endCursor: null };

  const showBrowseInstead = !query || products.length === 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-title sm:text-display">
          {query ? `Search results for "${query}"` : "Search"}
        </h1>
        {!query && (
          <p className="mt-2 text-neutral-500">Type in the search box above to find products.</p>
        )}
      </div>

      {query && (
        <ProductList
          key={query}
          initialProducts={products}
          initialHasNextPage={hasNextPage}
          initialEndCursor={endCursor}
          searchTerm={query}
        />
      )}

      {showBrowseInstead && (
        <section className="mt-12">
          <h2 className="text-lg font-medium">
            {query ? "Nothing matched — browse instead" : "Browse by category"}
          </h2>
          <div className="mt-6">
            <CategoryTiles />
          </div>
        </section>
      )}
    </div>
  );
}
