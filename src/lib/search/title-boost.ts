import type { Product } from "@/lib/shopify/types";

/**
 * Shopify's own relevance ranking has no notion of "this is the product family the shopper is
 * naming" vs. "this happens to mention that word" — a search for "iphone" can rank accessories
 * (cases, chargers, cross-compatible cables) alongside or ahead of the actual iPhone lineup
 * (audit finding H1). A product whose title starts with the query is almost certainly the thing
 * being searched for, so it's pulled to the front rather than trusting Shopify's ranking alone.
 *
 * Shared between the initial search page render and `loadMoreProducts` (src/lib/actions.ts) —
 * without reapplying this on "Load more", a title match landing on Shopify's second results page
 * would revert to unboosted order the moment it loads.
 */
export function boostTitleMatches(products: Product[], query: string): Product[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return products;
  const rank = (product: Product) => {
    const title = product.title.toLowerCase();
    if (title.startsWith(normalizedQuery)) return 0;
    if (title.includes(normalizedQuery)) return 1;
    return 2;
  };
  return [...products].sort((a, b) => rank(a) - rank(b));
}
