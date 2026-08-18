import type { Metadata } from "next";
import { CategoryTiles } from "@/components/category-tiles";
import { ProductList } from "@/components/product-list";
import { isSemanticSearchReady, searchProductsSemantic } from "@/lib/search/semantic-search";
import { boostTitleMatches } from "@/lib/search/title-boost";
import { getProducts, sanitizeFreeTextSearchTerm } from "@/lib/shopify";

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

/**
 * Semantic mode (when Vertex AI is configured and the catalog has been embedded — see
 * src/lib/search/semantic-search.ts) ranks the whole catalog by meaning rather than Shopify's
 * keyword match, so it fetches everything in one page rather than paginating via Shopify cursors,
 * which aren't meaningful once results are re-sorted by similarity.
 */
async function findMatchingProducts(query: string) {
  if (await isSemanticSearchReady()) {
    const { products } = await getProducts({ first: 100 });
    const ranked = await searchProductsSemantic(query, products);
    return { products: ranked, hasNextPage: false, endCursor: null, isSemantic: true };
  }
  const page = await getProducts({ searchTerm: sanitizeFreeTextSearchTerm(query) });
  return { ...page, products: boostTitleMatches(page.products, query), isSemantic: false };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  // Kept raw for display (React escapes it — no injection risk there); findMatchingProducts and
  // the searchTerm handed to ProductList (which feeds "load more" pagination) both sanitize it
  // before it ever becomes part of a Shopify search query.
  const query = q?.trim() ?? "";
  const { products, hasNextPage, endCursor, isSemantic } = query
    ? await findMatchingProducts(query)
    : { products: [], hasNextPage: false, endCursor: null, isSemantic: false };

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
        <>
          {isSemantic && products.length > 0 && (
            <p className="mb-4 text-sm text-neutral-500">
              Showing top {products.length} matches, ranked by relevance.
            </p>
          )}
          <ProductList
            key={query}
            initialProducts={products}
            initialHasNextPage={hasNextPage}
            initialEndCursor={endCursor}
            searchTerm={sanitizeFreeTextSearchTerm(query)}
            titleBoostQuery={isSemantic ? undefined : query}
          />
        </>
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
