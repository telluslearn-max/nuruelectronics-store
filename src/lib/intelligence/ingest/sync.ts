import "server-only";
import { prisma } from "@/lib/prisma";
import { getAllProducts } from "@/lib/shopify";
import type { Product } from "@/lib/shopify/types";
import { schemaForShopifyProductType } from "@/lib/intelligence/schema";
import { mapMetafields } from "@/lib/intelligence/ingest/metafield-map";
import { INGEST_SAMPLES, isIngestConfigured, researchProductSpecs } from "@/lib/intelligence/ingest/ai";
import { reconcileRuns } from "@/lib/intelligence/ingest/reconcile";
import { computeCompleteness } from "@/lib/intelligence/ingest/completeness";
import { replaceProfileSpecs } from "@/lib/intelligence/ingest/write-specs";
import { recomputeNuruScore } from "@/lib/intelligence/scoring/recompute";
import { applySmartphoneSeed } from "@/lib/intelligence/seed/apply";
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
  seeded: number;
  profilesSeen: number;
  profilesResearched: number;
  timedOut: boolean;
  aiConfigured: boolean;
};

/**
 * Serverless functions have a hard wall (Vercel: up to 300s). The full catalog
 * walk plus a few grounded-search passes can approach it, so the loop stops
 * starting new products once this much wall time has passed and reports
 * `timedOut: true` — the next run picks up where it left off.
 */
const RUN_DEADLINE_MS = 240_000;

function productIdentity(product: Product): { brand: string | null; model: string } {
  return { brand: product.vendor?.trim() || null, model: product.title };
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
  await replaceProfileSpecs(profile.id, "shopify_metafield", "Shopify specs metafield", null, mapped);

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
      await replaceProfileSpecs(
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
  const startedAt = Date.now();

  // The curated seed runs first, every time — it's fast, idempotent, and gives
  // the flagship products verified data immediately rather than waiting on the
  // grounded-search crawl.
  const seed = options.handles ? { applied: 0, models: 0 } : await applySmartphoneSeed();

  const allProducts = await getAllProducts({ includeSpecs: true, includeExUk: true, includeComingSoon: true });
  const targeted = options.handles
    ? allProducts.filter((p) => options.handles!.includes(p.handle))
    : allProducts;

  const budget = { researched: 0, max: options.maxResearched ?? 6 };
  let profilesSeen = 0;
  let timedOut = false;

  for (const product of targeted) {
    const schema = schemaForShopifyProductType(product.productType);
    if (!schema) continue;
    if (Date.now() - startedAt > RUN_DEADLINE_MS) {
      timedOut = true;
      break;
    }
    profilesSeen += 1;
    try {
      await syncOneProduct(product, schema, options, budget);
    } catch (error) {
      console.error(`[intelligence:sync] failed for "${product.handle}":`, error);
    }
  }

  return {
    seeded: seed.applied,
    profilesSeen,
    profilesResearched: budget.researched,
    timedOut,
    aiConfigured: isIngestConfigured,
  };
}
