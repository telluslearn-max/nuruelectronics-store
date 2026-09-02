import "server-only";
import type { SpecConfidence } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getProductByHandle } from "@/lib/shopify";
import { confidenceRank } from "@/lib/intelligence/provenance";
import { getCategorySchema } from "@/lib/intelligence/schema";
import type { ScoreComponent } from "@/lib/intelligence/types";
import type { Product } from "@/lib/shopify/types";
import type { Prisma } from "@prisma/client";

/**
 * The merged product record: Shopify's commercial facts (price, stock, image)
 * joined with NURU's intelligence (normalized specs + provenance + NURU Score).
 * This is the shape the storefront, the concierge and the WebMCP tools all read
 * a product through — one place the join happens, one DTO to keep stable.
 */

export type ResolvedSpec = {
  key: string;
  label: string;
  group: string;
  rawValue: string;
  normalizedValue: string | null;
  unit: string | null;
  confidence: SpecConfidence;
};

export type ProductIntelligenceView = {
  handle: string;
  shopifyProductId: string | null;
  title: string;
  brand: string | null;
  category: string;
  price: { amount: string; currencyCode: string } | null;
  availableForSale: boolean;
  imageUrl: string | null;
  dataCompleteness: number;
  nuruScore: {
    composite: number | null;
    components: Partial<Record<ScoreComponent, number>>;
    scoredComponents: string[];
  } | null;
  specs: ResolvedSpec[];
};

type SpecRow = {
  key: string;
  rawValue: string;
  normalizedValue: string | null;
  unit: string | null;
  confidence: SpecConfidence;
  collectedAt: Date;
};

/**
 * Resolves one product's stored SpecValues to a single value per key — highest
 * confidence, ties broken by most recently collected — and returns them in the
 * category schema's own attribute order, with label/group attached. Keys not in
 * the schema (or with no non-null value) are dropped.
 */
export async function resolveDetailedSpecs(profileId: string, categoryId: string): Promise<ResolvedSpec[]> {
  const schema = getCategorySchema(categoryId);
  if (!schema) return [];

  const rows = await prisma.specValue.findMany({
    where: { profileId },
    select: { key: true, rawValue: true, normalizedValue: true, unit: true, confidence: true, collectedAt: true },
  });

  const best = new Map<string, SpecRow>();
  for (const row of rows) {
    const current = best.get(row.key);
    if (
      !current ||
      confidenceRank(row.confidence) > confidenceRank(current.confidence) ||
      (confidenceRank(row.confidence) === confidenceRank(current.confidence) && row.collectedAt > current.collectedAt)
    ) {
      best.set(row.key, row);
    }
  }

  return schema.attributes
    .filter((attr) => best.has(attr.key))
    .map((attr) => {
      const row = best.get(attr.key)!;
      return {
        key: attr.key,
        label: attr.label,
        group: attr.group,
        rawValue: row.rawValue,
        normalizedValue: row.normalizedValue,
        unit: row.unit,
        confidence: row.confidence,
      };
    });
}

type ProfileWithScore = Prisma.ProductProfileGetPayload<{ include: { nuruScore: true } }>;

/** Assembles a view from already-fetched parts — used by both `getProductView` and list endpoints so a search page doesn't re-fetch each product. */
export function assembleView(
  handle: string,
  shopifyProduct: Product | null,
  profile: ProfileWithScore | null,
  specs: ResolvedSpec[],
): ProductIntelligenceView {
  return {
    handle,
    shopifyProductId: profile?.shopifyProductId ?? shopifyProduct?.id ?? null,
    title: shopifyProduct?.title ?? profile?.model ?? handle,
    brand: profile?.brand ?? shopifyProduct?.vendor ?? null,
    category: profile?.category ?? "",
    price: shopifyProduct
      ? {
          amount: shopifyProduct.priceRange.minVariantPrice.amount,
          currencyCode: shopifyProduct.priceRange.minVariantPrice.currencyCode,
        }
      : null,
    availableForSale: shopifyProduct?.availableForSale ?? false,
    imageUrl: shopifyProduct?.images[0]?.url ?? null,
    dataCompleteness: profile ? Number(profile.dataCompleteness) : 0,
    nuruScore: profile?.nuruScore
      ? {
          composite: profile.nuruScore.composite === null ? null : Number(profile.nuruScore.composite),
          components: (profile.nuruScore.components ?? {}) as Partial<Record<ScoreComponent, number>>,
          scoredComponents: profile.nuruScore.scoredComponents,
        }
      : null,
    specs,
  };
}

/** Full intelligence view for one product by handle, or null if it isn't in the catalog. */
export async function getProductView(handle: string): Promise<ProductIntelligenceView | null> {
  const [shopifyProduct, profile] = await Promise.all([
    getProductByHandle(handle),
    prisma.productProfile.findUnique({ where: { handle }, include: { nuruScore: true } }),
  ]);

  if (!shopifyProduct && !profile) return null;

  const specs = profile ? await resolveDetailedSpecs(profile.id, profile.category) : [];
  return assembleView(handle, shopifyProduct, profile, specs);
}
