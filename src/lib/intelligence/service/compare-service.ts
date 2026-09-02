import "server-only";
import type { SpecConfidence } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getProductByHandle } from "@/lib/shopify";
import { getCategorySchema } from "@/lib/intelligence/schema";
import {
  buildComparison,
  type ComparePayload,
  type CompareInputProduct,
} from "@/lib/intelligence/service/compare";
import { resolveDetailedSpecs } from "@/lib/intelligence/service/product-view";
import type { ScoreComponent } from "@/lib/intelligence/types";

/**
 * Loads the data for a set of product handles and runs the pure comparison
 * engine (compare.ts) over it. Products must share a category — comparing a
 * phone against a laptop has no shared schema to compare on, so a mixed set
 * returns null.
 */

export type { ComparePayload };

/** Loads and compares 2-4 product handles of one category; null if the set can't be compared. */
export async function compareByHandles(handles: string[]): Promise<ComparePayload | null> {
  const unique = [...new Set(handles)].slice(0, 4);
  if (unique.length < 2) return null;

  const profiles = await prisma.productProfile.findMany({
    where: { handle: { in: unique } },
    include: { nuruScore: true },
  });
  const byHandle = new Map(profiles.map((p) => [p.handle, p]));

  const categories = new Set(profiles.map((p) => p.category));
  if (categories.size !== 1) return null;
  const schema = getCategorySchema([...categories][0]);
  if (!schema) return null;

  const shopifyProducts = await Promise.all(unique.map((h) => getProductByHandle(h)));

  const inputs: CompareInputProduct[] = [];
  const titles: string[] = [];
  const prices: ComparePayload["prices"] = [];
  const availability: boolean[] = [];
  const images: (string | null)[] = [];
  const defaultVariantIds: (string | null)[] = [];

  for (let i = 0; i < unique.length; i += 1) {
    const handle = unique[i];
    const profile = byHandle.get(handle);
    if (!profile) return null;
    const shopify = shopifyProducts[i];
    const detailed = await resolveDetailedSpecs(profile.id, profile.category);
    const specs = new Map<
      string,
      { normalizedValue: string | null; rawValue: string; unit: string | null; confidence: SpecConfidence }
    >(detailed.map((s) => [s.key, s]));

    inputs.push({
      handle,
      specs,
      components: (profile.nuruScore?.components ?? {}) as Partial<Record<ScoreComponent, number>>,
      composite: profile.nuruScore?.composite == null ? null : Number(profile.nuruScore.composite),
    });
    titles.push(shopify?.title ?? profile.model ?? handle);
    prices.push(
      shopify
        ? {
            amount: shopify.priceRange.minVariantPrice.amount,
            currencyCode: shopify.priceRange.minVariantPrice.currencyCode,
          }
        : null,
    );
    availability.push(shopify?.availableForSale ?? false);
    images.push(shopify?.images[0]?.url ?? null);
    defaultVariantIds.push(shopify?.variants[0]?.id ?? null);
  }

  return { ...buildComparison(inputs, schema), titles, prices, availability, images, defaultVariantIds };
}
