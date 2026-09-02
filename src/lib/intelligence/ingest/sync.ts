import "server-only";
import { prisma } from "@/lib/prisma";
import { getAllProducts } from "@/lib/shopify";
import type { Product } from "@/lib/shopify/types";
import { schemaForShopifyProductType } from "@/lib/intelligence/schema";
import { mapMetafields } from "@/lib/intelligence/ingest/metafield-map";
import { INGEST_SAMPLES, isIngestConfigured, researchProductSpecs } from "@/lib/intelligence/ingest/ai";
import { reconcileRuns } from "@/lib/intelligence/ingest/reconcile";
import { computeCompleteness } from "@/lib/intelligence/ingest/completeness";
import { confidenceForSourceType } from "@/lib/intelligence/provenance";
import { recomputeNuruScore } from "@/lib/intelligence/scoring/recompute";
import type { CategorySchema } from "@/lib/intelligence/types";

/**
 * The nightly product-intelligence sync (see /api/cron/sync-product-intelligence).
 *
 * For every catalog product whose `product_type` maps to a category schema:
 *   1. upsert its ProductProfile
 *   2. write Shopify `specs`-metafield values that map cleanly (high confidence)
 *   3. if it's new, stale, or forced, run the AI grounded-search pass
 *      (INGEST_SAMPLES times, reconciled — see ai.ts / reconcile.ts) and write
 *      whatever the runs agreed on (low confidence)
 *   4. recompute dataCompleteness from everything now on file
 *
 * Each product's writes replace that product's prior values from the same
 * source type rather than accumulating — a re-sync corrects the record, it
 * doesn't grow it. Products are processed sequentially: the AI pass is the
 * only slow/costly step and there's no benefit to parallelising Vertex calls
 * against per-minute quota.
 */

/** Below this completeness, a product is re-researched on every sync regardless of age. */
const RESEARCH_COMPLETENESS_FLOOR = 0.6;
/** Above the floor, a product is still re-researched after this many days (specs do get corrected/updated). */
const RESEARCH_MAX_AGE_DAYS = 30;

export type SyncOptions = {
  /** Only sync these Shopify handles (e.g. for a manual re-run on one product). */
  handles?: string[];
  /** Re-run AI research even if the product looks fresh and complete. */
  force?: boolean;
  /** Cap how many products get an AI research pass in one run, to bound cost/duration. */
  maxResearched?: number;
};

export type SyncResult = {
  profilesSeen: number;
  profilesResearched: number;
  aiConfigured: boolean;
};

function productIdentity(product: Product): { brand: string | null; model: string } {
  return { brand: product.vendor?.trim() || null, model: product.title };
}

async function replaceSourceValues(
  profileId: string,
  sourceType: "shopify_metafield" | "ai_grounded",
  label: string,
  reference: string | null,
  values: { key: string; rawValue: string; normalizedValue: string | null; unit: string | null }[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Drop this profile's prior values from this source type, and any source
    // rows that are left referencing nothing, before writing the fresh set —
    // a re-sync corrects the record rather than accumulating rows in it.
    const stale = await tx.specValue.findMany({
      where: { profileId, source: { type: sourceType } },
      select: { id: true, sourceId: true },
    });
    if (stale.length > 0) {
      await tx.specValue.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
      const staleSourceIds = [...new Set(stale.map((s) => s.sourceId))];
      for (const sourceId of staleSourceIds) {
        const remaining = await tx.specValue.count({ where: { sourceId } });
        if (remaining === 0) await tx.intelSource.delete({ where: { id: sourceId } }).catch(() => undefined);
      }
    }

    if (values.length === 0) return;

    const source = await tx.intelSource.create({
      data: { type: sourceType, label, reference },
    });
    const confidence = confidenceForSourceType(sourceType);
    await tx.specValue.createMany({
      data: values.map((v) => ({
        profileId,
        key: v.key,
        rawValue: v.rawValue,
        normalizedValue: v.normalizedValue,
        unit: v.unit,
        confidence,
        sourceId: source.id,
      })),
    });
  });
}

function needsResearch(
  force: boolean | undefined,
  dataCompleteness: number,
  lastSyncedAt: Date | null,
): boolean {
  if (force) return true;
  if (dataCompleteness < RESEARCH_COMPLETENESS_FLOOR) return true;
  if (!lastSyncedAt) return true;
  const ageDays = (Date.now() - lastSyncedAt.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays > RESEARCH_MAX_AGE_DAYS;
}

async function syncOneProduct(
  product: Product,
  schema: CategorySchema,
  options: SyncOptions,
  budget: { researched: number; max: number },
): Promise<void> {
  const { brand, model } = productIdentity(product);
  const profile = await prisma.productProfile.upsert({
    where: { shopifyProductId: product.id },
    create: {
      shopifyProductId: product.id,
      handle: product.handle,
      category: schema.id,
      brand,
      model,
    },
    update: { handle: product.handle, category: schema.id, brand, model },
  });

  const mapped = mapMetafields(schema.id, product.specs ?? []);
  await replaceSourceValues(profile.id, "shopify_metafield", "Shopify specs metafield", null, mapped);

  let researched = false;
  if (
    isIngestConfigured &&
    budget.researched < budget.max &&
    needsResearch(options.force, Number(profile.dataCompleteness), profile.lastSyncedAt)
  ) {
    const runs = (
      await Promise.all(
        Array.from({ length: INGEST_SAMPLES }, () =>
          researchProductSpecs(schema, { title: product.title, vendor: product.vendor }),
        ),
      )
    ).filter((r): r is NonNullable<typeof r> => r !== null);

    if (runs.length >= 2) {
      const { agreed } = reconcileRuns(
        schema,
        runs.map((r) => r.run),
      );
      const citations = [...new Set(runs.flatMap((r) => r.citations))];
      await replaceSourceValues(
        profile.id,
        "ai_grounded",
        "Gemini grounded search",
        citations[0] ?? null,
        agreed,
      );
      researched = true;
      budget.researched += 1;
    }
  }

  const allKeys = await prisma.specValue.findMany({ where: { profileId: profile.id }, select: { key: true } });
  const dataCompleteness = computeCompleteness(schema, allKeys.map((k) => k.key));
  await prisma.productProfile.update({
    where: { id: profile.id },
    data: {
      dataCompleteness,
      ...(researched ? { lastSyncedAt: new Date() } : {}),
    },
  });

  await recomputeNuruScore(profile.id, schema);
}

/** Walks the whole catalog and (re)builds product-intelligence records — see the module doc above. */
export async function syncProductIntelligence(options: SyncOptions = {}): Promise<SyncResult> {
  const allProducts = await getAllProducts({ includeSpecs: true, includeExUk: true, includeComingSoon: true });
  const targeted = options.handles
    ? allProducts.filter((p) => options.handles!.includes(p.handle))
    : allProducts;

  const budget = { researched: 0, max: options.maxResearched ?? 40 };
  let profilesSeen = 0;

  for (const product of targeted) {
    const schema = schemaForShopifyProductType(product.productType);
    if (!schema) continue;
    profilesSeen += 1;
    try {
      await syncOneProduct(product, schema, options, budget);
    } catch (error) {
      console.error(`[intelligence:sync] failed for "${product.handle}":`, error);
    }
  }

  return { profilesSeen, profilesResearched: budget.researched, aiConfigured: isIngestConfigured };
}
