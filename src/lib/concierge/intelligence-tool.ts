import "server-only";
import { getProductsByHandles } from "@/lib/actions";
import type { Product } from "@/lib/shopify/types";
import { getCategorySchema } from "@/lib/intelligence/schema";
import type { FitWeights } from "@/lib/intelligence/recommend/fit-score";
import { rankByFit } from "@/lib/intelligence/recommend/rank";
import { explainWhyNot } from "@/lib/intelligence/recommend/why-not";
import { explainProductFit } from "@/lib/intelligence/service/explain-service";
import { getScoredCandidateByHandle } from "@/lib/intelligence/recommend/candidates";
import { parseWeights } from "@/lib/intelligence/service/params";
import { parseSearchIntent } from "@/lib/intelligence/service/intent";
import { scoreProduct } from "@/lib/intelligence/service/score";
import { resolveDetailedSpecs, getProductView } from "@/lib/intelligence/service/product-view";
import { recommendProducts, findAlternativesFor } from "@/lib/intelligence/service/recommend";
import { prisma } from "@/lib/prisma";

/**
 * The concierge's window onto the product-intelligence engine (src/lib/intelligence/).
 *
 * Every function here is a thin adapter: it turns the model's arguments into a
 * call on the deterministic engine and projects the result down to the compact
 * shape the model needs to talk about. The model never does the scoring — it
 * supplies the shopper's priorities as weights, the engine does the arithmetic,
 * and the model narrates what comes back.
 */

/** Concierge category slugs that map to an intelligence category schema. Others aren't covered yet. */
const SLUG_TO_CATEGORY: Record<string, string> = { phones: "smartphone" };

/** The intelligence category schema id for a concierge category slug ("phones" → "smartphone"), or null if uncovered. */
export function resolveIntelligenceCategory(slugOrId: string): string | null {
  if (getCategorySchema(slugOrId)) return slugOrId;
  return SLUG_TO_CATEGORY[slugOrId] ?? null;
}

/** Weights from a model-supplied object, or parsed from free text if that's all we got. */
export function weightsFrom(priorities: unknown, prioritiesText: unknown): FitWeights {
  const structured = parseWeights(priorities);
  if (Object.keys(structured).length > 0) return structured;
  if (typeof prioritiesText === "string" && prioritiesText.trim()) {
    return parseSearchIntent(prioritiesText).weights;
  }
  return {};
}

export type ModelSpecView = {
  handle: string;
  category: string;
  dataCompleteness: number;
  nuruScore: { composite: number | null; components: Partial<Record<string, number>> } | null;
  specs: { key: string; label: string; group: string; value: string; confidence: string }[];
};

/** Resolved, normalized specs + NURU Score for one product — richer than get_product_details' raw Shopify metafields. */
export async function getProductSpecsForModel(handle: string): Promise<ModelSpecView | { error: string }> {
  const profile = await prisma.productProfile.findUnique({ where: { handle } });
  if (!profile) {
    return { error: "No product-intelligence profile for that handle yet — use get_product_details for raw specs." };
  }
  const [specs, view] = await Promise.all([
    resolveDetailedSpecs(profile.id, profile.category),
    getProductView(handle),
  ]);
  return {
    handle,
    category: profile.category,
    dataCompleteness: Number(profile.dataCompleteness),
    nuruScore: view?.nuruScore
      ? { composite: view.nuruScore.composite, components: view.nuruScore.components }
      : null,
    specs: specs
      .filter((s) => s.normalizedValue !== null)
      .map((s) => ({
        key: s.key,
        label: s.label,
        group: s.group,
        value: s.rawValue,
        confidence: s.confidence,
      })),
  };
}

export type ModelRecommendation = {
  rank: number;
  handle: string;
  title: string;
  price: { amount: string; currencyCode: string } | null;
  availableForSale: boolean;
  nuruScore: number | null;
  fitScore: number | null;
  fitCoverage: number;
  reasoning: { strengths: string[]; weaknesses: string[]; primaryReason: string[] };
};

/** Ranked, in-budget, in-stock recommendations for the model, plus the Product objects for the UI. */
export async function recommendForModel(args: {
  category: string;
  weights: FitWeights;
  budgetMin?: number;
  budgetMax?: number;
  brand?: string;
}): Promise<{ recommendations: ModelRecommendation[]; products: Product[] } | { error: string }> {
  const categoryId = resolveIntelligenceCategory(args.category);
  if (!categoryId) {
    return { error: `No product-intelligence coverage for "${args.category}" yet — use search_products instead.` };
  }
  if (Object.keys(args.weights).length === 0) {
    return { error: "Need the shopper's priorities as weights before recommending — ask what matters most first." };
  }

  const results = await recommendProducts({
    categoryId,
    weights: args.weights,
    budgetMin: args.budgetMin,
    budgetMax: args.budgetMax,
    brand: args.brand,
    limit: 3,
  });
  const products = await getProductsByHandles(results.map((r) => r.handle));

  return {
    recommendations: results.map((r) => ({
      rank: r.rank,
      handle: r.handle,
      title: r.title,
      price: r.price,
      availableForSale: r.availableForSale,
      nuruScore: r.nuruScore?.composite ?? null,
      fitScore: r.fitScore,
      fitCoverage: r.fitCoverage,
      reasoning: {
        strengths: r.reasoning.strengths,
        weaknesses: r.reasoning.weaknesses,
        primaryReason: r.reasoning.primaryDrivers,
      },
    })),
    products,
  };
}

/** One product's NURU + Fit Score for the shopper's weights. */
export async function calculateFitScoreForModel(handle: string, weights: FitWeights) {
  const result = await scoreProduct(handle, weights);
  if (!result) return { error: "No NURU Score for that handle yet." };
  return result;
}

/** Structured strengths / weaknesses / primary reason for one product against the shopper's weights. */
export async function explainRecommendationForModel(handle: string, weights: FitWeights) {
  const rec = await explainProductFit(handle, weights);
  if (!rec) return { error: "No NURU Score for that handle yet." };
  return {
    handle,
    fitScore: rec.fitScore,
    coverage: rec.coverage,
    strengths: rec.strengths,
    weaknesses: rec.weaknesses,
    primaryReason: rec.primaryDrivers,
  };
}

/** The component-by-component split behind "why not X" for the shopper's weights. */
export async function whyNotForModel(rejectedHandle: string, winnerHandle: string, weights: FitWeights) {
  const [rejected, winner] = await Promise.all([
    getScoredCandidateByHandle(rejectedHandle),
    getScoredCandidateByHandle(winnerHandle),
  ]);
  if (!rejected || !winner) return { error: "One or both handles have no NURU Score yet." };
  const [rankedRejected, rankedWinner] = rankByFit([rejected, winner], weights);
  const byHandle = new Map([rankedRejected, rankedWinner].map((c) => [c.handle, c]));
  return explainWhyNot(byHandle.get(rejectedHandle)!, byHandle.get(winnerHandle)!, weights);
}

/** In-stock alternatives to a target product that retain most of its capability, plus Product objects for the UI. */
export async function findAlternativesForModel(handle: string, weights: FitWeights) {
  const alternatives = await findAlternativesFor({ handle, weights, limit: 3 });
  const products = await getProductsByHandles(alternatives.map((a) => a.handle));
  return {
    alternatives: alternatives.map((a) => ({
      handle: a.handle,
      title: a.title,
      price: a.price,
      matchScore: a.matchScore,
      meetsThreshold: a.meetsThreshold,
      shortfalls: a.shortfalls,
    })),
    products,
  };
}
