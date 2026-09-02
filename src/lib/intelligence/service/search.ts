import "server-only";
import { prisma } from "@/lib/prisma";
import { getProducts } from "@/lib/shopify";
import { searchProductsSemantic } from "@/lib/search/semantic-search";
import { isConciergeConfigured } from "@/lib/concierge/embeddings";
import type { Product } from "@/lib/shopify/types";
import { getCategorySchema } from "@/lib/intelligence/schema";
import { parseSearchIntent, type SearchIntent } from "@/lib/intelligence/service/intent";
import {
  assembleView,
  resolveDetailedSpecs,
  type ProductIntelligenceView,
} from "@/lib/intelligence/service/product-view";

/**
 * Structured + semantic product search.
 *
 * `parseSearchIntent` pulls the hard filters (category, budget, brand) out of a
 * raw query deterministically; those are applied as real filters, not hints.
 * Whatever free text is left ranks the survivors by embedding similarity when
 * semantic search is configured, or by NURU Score otherwise. The result is
 * always full `ProductIntelligenceView`s so a caller never has to make a second
 * round of lookups.
 */

export type ProductSearchParams = {
  query?: string;
  categoryId?: string;
  budgetMin?: number;
  budgetMax?: number;
  brand?: string;
  limit?: number;
};

export type ProductSearchResult = {
  intent: SearchIntent;
  products: ProductIntelligenceView[];
};

function categoryQuery(shopifyProductTypes: string[]): string {
  return shopifyProductTypes.map((t) => `product_type:${JSON.stringify(t)}`).join(" OR ");
}

function priceOf(product: Product): number {
  return Number(product.priceRange.minVariantPrice.amount);
}

/** Runs a structured + semantic product search and returns full intelligence views. See module doc. */
export async function searchProductIntelligence(params: ProductSearchParams): Promise<ProductSearchResult> {
  const intent = params.query ? parseSearchIntent(params.query) : emptyIntent();

  const categoryId = params.categoryId ?? intent.categoryId;
  const budgetMin = params.budgetMin ?? intent.budgetMin ?? undefined;
  const budgetMax = params.budgetMax ?? intent.budgetMax ?? undefined;
  const brand = params.brand ?? intent.brand ?? undefined;
  const limit = params.limit ?? 12;

  const schema = categoryId ? getCategorySchema(categoryId) : null;
  const searchTerm = schema ? categoryQuery(schema.shopifyProductTypes) : undefined;

  const { products: catalog } = await getProducts({
    searchTerm,
    first: schema ? 100 : 40,
    includeSpecs: false,
  });

  let candidates = catalog.filter((p) => {
    const price = priceOf(p);
    if (budgetMin !== undefined && price < budgetMin) return false;
    if (budgetMax !== undefined && price > budgetMax) return false;
    if (brand && !(p.vendor ?? "").toLowerCase().includes(brand.toLowerCase())) return false;
    return true;
  });

  if (intent.freeText && isConciergeConfigured) {
    candidates = await searchProductsSemantic(intent.freeText, candidates, Math.max(limit * 2, 24));
  }

  const handles = candidates.map((p) => p.handle);
  const profiles = await prisma.productProfile.findMany({
    where: { handle: { in: handles } },
    include: { nuruScore: true },
  });
  const profileByHandle = new Map(profiles.map((p) => [p.handle, p]));

  const views = await Promise.all(
    candidates.map(async (product) => {
      const profile = profileByHandle.get(product.handle) ?? null;
      const specs = profile ? await resolveDetailedSpecs(profile.id, profile.category) : [];
      return assembleView(product.handle, product, profile, specs);
    }),
  );

  // With no free-text ranking, order by composite NURU Score (best first, unscored last).
  if (!intent.freeText || !isConciergeConfigured) {
    views.sort((a, b) => (b.nuruScore?.composite ?? -1) - (a.nuruScore?.composite ?? -1));
  }

  return { intent, products: views.slice(0, limit) };
}

function emptyIntent(): SearchIntent {
  return { categoryId: null, budgetMin: null, budgetMax: null, brand: null, weights: {}, freeText: "" };
}
