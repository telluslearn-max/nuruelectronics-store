import "server-only";
import { categories } from "@/lib/categories";
import { ecosystems, getEcosystem, getKit, kits } from "@/lib/collections";
import { getProductByHandle, getProducts } from "@/lib/shopify";
import type { Product } from "@/lib/shopify/types";

export async function searchProducts(args: {
  query?: string;
  categorySlug?: string;
  ecosystemSlug?: string;
  kitSlug?: string;
  first?: number;
}): Promise<Product[]> {
  const { query, categorySlug, ecosystemSlug, kitSlug, first } = args;

  let searchTerm = query?.trim() || undefined;
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
