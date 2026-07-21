import "server-only";
import { categoryForProductType } from "@/lib/categories";
import { getProducts } from "@/lib/shopify";
import type { Product } from "@/lib/shopify/types";

export type Savings = {
  amount: string;
  currencyCode: string;
  percent: number;
};

function titleWords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

/** True when the shorter title's words are all present in the longer one — same model, e.g. "iPhone 14 Pro" vs "iPhone 14 Pro (Ex-UK)". */
function isSameModel(a: string, b: string): boolean {
  const wordsA = titleWords(a);
  const wordsB = titleWords(b);
  const [shorter, longer] = wordsA.length <= wordsB.length ? [wordsA, wordsB] : [wordsB, wordsA];
  if (shorter.length === 0) return false;
  const longerSet = new Set(longer);
  return shorter.every((w) => longerSet.has(w));
}

/**
 * Finds another listing for the same model — used both to find an ex-uk unit's "new" price
 * counterpart and, in reverse, to find a regular listing's cheaper ex-uk counterpart. Fetches
 * candidates with a plain, already-supported category query (works in both mock and real Shopify
 * mode) and does the "same model" / ex-uk-tag matching in JS, rather than pushing AND-combined
 * clauses into the Shopify query string — matchesSearchTerm (src/lib/shopify/index.ts) only
 * understands simple OR-joined clauses, so anything more elaborate would silently fail locally.
 */
export async function findCounterpart(
  product: Product,
  options: { requireExUk: boolean },
): Promise<Product | null> {
  const category = categoryForProductType(product.productType);
  if (!category) return null;

  const { products } = await getProducts({ searchTerm: category.query, first: 50 });
  const match = products.find((p) => {
    if (p.handle === product.handle) return false;
    if (p.tags.includes("ex-uk") !== options.requireExUk) return false;
    return isSameModel(product.title, p.title);
  });
  return match ?? null;
}

export function computeSavings(exUkPrice: string, newPrice: string, currencyCode: string): Savings | null {
  const exUk = Number(exUkPrice);
  const brandNew = Number(newPrice);
  if (!(brandNew > exUk)) return null;
  const amount = (brandNew - exUk).toFixed(2);
  const percent = Math.round(((brandNew - exUk) / brandNew) * 100);
  return { amount, currencyCode, percent };
}
