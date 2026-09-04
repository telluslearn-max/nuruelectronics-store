import "server-only";
import { prisma } from "@/lib/prisma";
import { getCategorySchema } from "@/lib/intelligence/schema";
import { normalizeRecord } from "@/lib/intelligence/normalize";
import { computeCompleteness } from "@/lib/intelligence/ingest/completeness";
import { replaceProfileSpecs, type SpecWrite } from "@/lib/intelligence/ingest/write-specs";
import { recomputeNuruScore } from "@/lib/intelligence/scoring/recompute";

/** One row of a category's curated seed — identity fields plus the join key. */
export type SeedEntry = {
  shopifyProductId: string;
  brand: string;
  productFamily: string;
  model: string;
  releaseYear: number;
};

/**
 * Applies one category's curated seed: for each handle, resolve its model's
 * spec sheet, upsert the ProductProfile, write the specs as a `nuru_csv`
 * (verified-confidence) source, and recompute its NURU Score. Idempotent —
 * safe to run on every sync.
 *
 * Shared by every category's `seed/apply.ts` so the upsert/write/recompute
 * mechanics live in one place; `resolveSpecs` is the one thing that differs
 * per category (a flat model table for most categories, a brand-keyed lookup
 * for smartphones — see seed/apply.ts).
 */
export async function applyCuratedSeed(
  categoryId: string,
  seed: Record<string, SeedEntry>,
  resolveSpecs: (entry: SeedEntry) => Record<string, string> | undefined,
): Promise<{ applied: number }> {
  const schema = getCategorySchema(categoryId);
  if (!schema) return { applied: 0 };

  let applied = 0;
  for (const [handle, entry] of Object.entries(seed)) {
    const specs = resolveSpecs(entry);
    if (!specs) continue;

    try {
      const profile = await prisma.productProfile.upsert({
        where: { shopifyProductId: entry.shopifyProductId },
        create: {
          shopifyProductId: entry.shopifyProductId,
          handle,
          category: categoryId,
          brand: entry.brand,
          productFamily: entry.productFamily,
          model: entry.model,
          releaseYear: entry.releaseYear,
        },
        update: {
          handle,
          category: categoryId,
          brand: entry.brand,
          productFamily: entry.productFamily,
          model: entry.model,
          releaseYear: entry.releaseYear,
        },
      });

      const normalized = normalizeRecord(schema.attributes, specs);
      const values: SpecWrite[] = [...normalized.entries()].map(([key, { rawValue, normalized: n }]) => ({
        key,
        rawValue,
        normalizedValue: n.normalizedValue,
        unit: n.unit,
      }));

      await replaceProfileSpecs(profile.id, "nuru_csv", "NURU verified spec sheet", null, values);

      const allKeys = await prisma.specValue.findMany({
        where: { profileId: profile.id },
        select: { key: true },
      });
      await prisma.productProfile.update({
        where: { id: profile.id },
        data: { dataCompleteness: computeCompleteness(schema, allKeys.map((k) => k.key)), lastSyncedAt: new Date() },
      });
      await recomputeNuruScore(profile.id, schema);
      applied += 1;
    } catch (error) {
      console.error(`[intelligence:seed:${categoryId}] failed for "${handle}":`, error);
    }
  }

  return { applied };
}
