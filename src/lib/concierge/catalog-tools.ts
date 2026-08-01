import "server-only";
import { categories } from "@/lib/categories";
import { ecosystems, getEcosystem, getKit, kits } from "@/lib/collections";
import { getProductByHandle, getProducts } from "@/lib/shopify";
import type { Product } from "@/lib/shopify/types";

/**
 * Builds an explicit AND-of-wildcards Shopify search query instead of passing free text
 * through as-is. Shopify's default free-text product search doesn't reliably match when the
 * shopper's words aren't a contiguous substring of the title (e.g. "Samsung A37" won't match
 * "Samsung Galaxy A37 8/256GB" — "Galaxy" sits in between) or for mixed alphanumeric tokens
 * like model numbers. Requiring each word to independently appear somewhere in title/vendor/tag
 * fixes both.
 */
function buildFreeTextQuery(text: string): string {
  const words = text
    .trim()
    .split(/\s+/)
    // Strip characters Shopify's search syntax treats as structural (grouping/field-scoping),
    // so a crafted word can't break out of the `(title:*w* OR ...)` wrapper below and
    // restructure the query — e.g. to bypass the ex-uk/coming-soon exclusions getProducts ANDs on.
    .map((w) => w.replace(/["*():]/g, ""))
    .filter(Boolean);
  if (words.length === 0) return "";
  return words.map((w) => `(title:*${w}* OR vendor:*${w}* OR tag:*${w}*)`).join(" AND ");
}

export async function searchProducts(args: {
  query?: string;
  categorySlug?: string;
  ecosystemSlug?: string;
  kitSlug?: string;
  first?: number;
}): Promise<Product[]> {
  const { query, categorySlug, ecosystemSlug, kitSlug, first } = args;

  const trimmedQuery = query?.trim();
  let searchTerm = trimmedQuery ? buildFreeTextQuery(trimmedQuery) : undefined;
  if (categorySlug) {
    const category = categories.find((c) => c.slug === categorySlug);
    if (category) searchTerm = category.query;
  }
  if (ecosystemSlug) {
    const ecosystem = getEcosystem(ecosystemSlug);
    if (ecosystem) searchTerm = ecosystem.query;
  }
  if (kitSlug) {
    const kit = getKit(kitSlug);
    if (kit) searchTerm = kit.query;
  }

  const { products } = await getProducts({ searchTerm, first: first ?? 8 });
  return products;
}

export async function getProductDetails(handle: string): Promise<Product | null> {
  return getProductByHandle(handle);
}

export async function compareProducts(handles: string[]): Promise<Product[]> {
  const results = await Promise.all(handles.slice(0, 4).map((handle) => getProductByHandle(handle)));
  return results.filter((p): p is Product => p !== null);
}

export function listKitsOrEcosystems(kind: "kits" | "ecosystems" | "both") {
  return {
    kits: kind !== "ecosystems" ? kits : undefined,
    ecosystems: kind !== "kits" ? ecosystems : undefined,
  };
}
