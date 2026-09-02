import "server-only";
import { prisma } from "@/lib/prisma";
import { getProducts } from "@/lib/shopify";
import type { Product } from "@/lib/shopify/types";
import { getScoredCandidateByHandle, getScoredCandidates } from "@/lib/intelligence/recommend/candidates";
import { rankByFit, type ScoredCandidate } from "@/lib/intelligence/recommend/rank";
import { explainRecommendation, type Recommendation } from "@/lib/intelligence/recommend/explain";
import { rankAlternatives, type AlternativeMatch } from "@/lib/intelligence/recommend/alternatives";
import type { FitWeights } from "@/lib/intelligence/recommend/fit-score";
import { getCategorySchema } from "@/lib/intelligence/schema";
import {
  assembleView,
  resolveDetailedSpecs,
  type ProductIntelligenceView,
} from "@/lib/intelligence/service/product-view";

/**
 * Recommendation and alternatives, wired to real commerce.
 *
 * The ranking / reasoning math lives in src/lib/intelligence/recommend/ and is
 * pure. This module feeds it the scored pool, then filters and annotates the
 * result with Shopify's price and stock — so a recommendation never
 * confidently says "buy this" for something that's out of stock, and the
 * alternatives engine only ever suggests things a shopper can actually buy.
 */

export type RecommendedProduct = ProductIntelligenceView & {
  fitScore: number | null;
  fitCoverage: number;
  rank: number;
  reasoning: Recommendation;
};

export type RecommendParams = {
  categoryId: string;
  weights: FitWeights;
  budgetMin?: number;
  budgetMax?: number;
  brand?: string;
  limit?: number;
  /** Default true — drop out-of-stock products from the recommendation list. */
  requireAvailable?: boolean;
};

function categoryQuery(shopifyProductTypes: string[]): string {
  return shopifyProductTypes.map((t) => `product_type:${JSON.stringify(t)}`).join(" OR ");
}

function priceOf(product: Product): number {
  return Number(product.priceRange.minVariantPrice.amount);
}

async function loadCatalogFor(categoryId: string): Promise<Map<string, Product>> {
  const schema = getCategorySchema(categoryId);
  if (!schema) return new Map();
  const { products } = await getProducts({ searchTerm: categoryQuery(schema.shopifyProductTypes), first: 100 });
  return new Map(products.map((p) => [p.handle, p]));
}

async function toView(candidate: ScoredCandidate & { profileId?: string }, shopifyProduct: Product | null) {
  const profile = candidate.profileId
    ? await prisma.productProfile.findUnique({ where: { id: candidate.profileId }, include: { nuruScore: true } })
    : await prisma.productProfile.findUnique({ where: { handle: candidate.handle }, include: { nuruScore: true } });
  const specs = profile ? await resolveDetailedSpecs(profile.id, profile.category) : [];
  return assembleView(candidate.handle, shopifyProduct, profile, specs);
}

/** Ranked, in-budget, in-stock recommendations for a shopper's priorities, each with structured reasoning. */
export async function recommendProducts(params: RecommendParams): Promise<RecommendedProduct[]> {
  const { categoryId, weights, budgetMin, budgetMax, brand, limit = 3, requireAvailable = true } = params;

  const candidates = await getScoredCandidates(categoryId);
  const ranked = rankByFit(candidates, weights);
  const catalog = await loadCatalogFor(categoryId);

  const results: RecommendedProduct[] = [];
  for (const candidate of ranked) {
    if (results.length >= limit) break;
    const shopifyProduct = catalog.get(candidate.handle) ?? null;
    if (requireAvailable && !shopifyProduct?.availableForSale) continue;
    if (shopifyProduct) {
      const price = priceOf(shopifyProduct);
      if (budgetMin !== undefined && price < budgetMin) continue;
      if (budgetMax !== undefined && price > budgetMax) continue;
      if (brand && !(shopifyProduct.vendor ?? "").toLowerCase().includes(brand.toLowerCase())) continue;
    }
    const view = await toView(candidate, shopifyProduct);
    results.push({
      ...view,
      fitScore: candidate.fitScore,
      fitCoverage: candidate.coverage,
      rank: results.length + 1,
      reasoning: explainRecommendation(candidate, weights),
    });
  }
  return results;
}

export type AlternativeProduct = ProductIntelligenceView & AlternativeMatch;

export type AlternativesParams = {
  handle: string;
  weights?: FitWeights;
  limit?: number;
  threshold?: number;
  requireAvailable?: boolean;
};

/**
 * "The requested model is unavailable — here's what still does most of what it
 * would have done for you." Ranks the target's category by capability retained
 * (recommend/alternatives.ts), then keeps only the ones actually in stock.
 */
export async function findAlternativesFor(params: AlternativesParams): Promise<AlternativeProduct[]> {
  const { handle, weights = {}, limit = 3, threshold, requireAvailable = true } = params;

  const target = await getScoredCandidateByHandle(handle);
  if (!target) return [];

  const pool = (await getScoredCandidates(target.category)).filter((c) => c.handle !== handle);
  const matches = rankAlternatives(target, pool, weights, threshold);
  const catalog = await loadCatalogFor(target.category);

  const results: AlternativeProduct[] = [];
  for (const match of matches) {
    if (results.length >= limit) break;
    const shopifyProduct = catalog.get(match.handle) ?? null;
    if (requireAvailable && !shopifyProduct?.availableForSale) continue;
    const candidate = pool.find((c) => c.handle === match.handle)!;
    const view = await toView(candidate, shopifyProduct);
    results.push({ ...view, ...match });
  }
  return results;
}
