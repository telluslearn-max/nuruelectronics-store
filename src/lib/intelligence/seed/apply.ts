import "server-only";
import { prisma } from "@/lib/prisma";
import { getCategorySchema } from "@/lib/intelligence/schema";
import { normalizeRecord } from "@/lib/intelligence/normalize";
import { computeCompleteness } from "@/lib/intelligence/ingest/completeness";
import { replaceProfileSpecs, type SpecWrite } from "@/lib/intelligence/ingest/write-specs";
import { recomputeNuruScore } from "@/lib/intelligence/scoring/recompute";
import { GALAXY_MODEL_SPECS, IPHONE_MODEL_SPECS, SMARTPHONE_SEED } from "@/lib/intelligence/seed/smartphones";

/** Brand -> its curated model-spec table. Extend this map, not the loop below, when a new brand is seeded. */
const SPECS_BY_BRAND: Record<string, Record<string, Record<string, string>>> = {
  Apple: IPHONE_MODEL_SPECS,
  Samsung: GALAXY_MODEL_SPECS,
};

/**
 * Applies the curated smartphone seed (src/lib/intelligence/seed/smartphones.ts):
 * for each seeded handle, upsert its ProductProfile, write the model's specs as
 * a `nuru_csv` (verified-confidence) source, and recompute its NURU Score.
 * Idempotent — safe to run on every sync.
 */
export async function applySmartphoneSeed(): Promise<{ applied: number; models: number }> {
  const schema = getCategorySchema("smartphone");
  if (!schema) return { applied: 0, models: 0 };

  let applied = 0;
  for (const [handle, entry] of Object.entries(SMARTPHONE_SEED)) {
    const brand = entry.brand ?? "Apple";
    const productFamily = entry.productFamily ?? "iPhone";
    const specs = SPECS_BY_BRAND[brand]?.[entry.model];
    if (!specs) continue;

    try {
      const profile = await prisma.productProfile.upsert({
        where: { shopifyProductId: entry.shopifyProductId },
        create: {
          shopifyProductId: entry.shopifyProductId,
          handle,
          category: "smartphone",
          brand,
          productFamily,
          model: entry.model,
          releaseYear: entry.releaseYear,
        },
        update: {
          handle,
          category: "smartphone",
          brand,
          productFamily,
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
      console.error(`[intelligence:seed] failed for "${handle}":`, error);
    }
  }

  const modelCount = Object.values(SPECS_BY_BRAND).reduce((sum, table) => sum + Object.keys(table).length, 0);
  return { applied, models: modelCount };
}
