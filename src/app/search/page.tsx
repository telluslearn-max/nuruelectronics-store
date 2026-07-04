import type { Metadata } from "next";
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {query ? `Search results for "${query}"` : "Search"}
        </h1>
      </div>
      {query ? (
        <ProductList
          initialProducts={products}
          initialHasNextPage={hasNextPage}
          initialEndCursor={endCursor}
          searchTerm={query}
        />
      ) : (
        <p className="py-16 text-center text-neutral-500">Enter a search term above.</p>
      )}
    </div>
  );
}
