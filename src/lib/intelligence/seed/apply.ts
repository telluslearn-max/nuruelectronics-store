import "server-only";
import { applyCuratedSeed, type SeedEntry } from "@/lib/intelligence/seed/apply-shared";
import { GALAXY_MODEL_SPECS, IPHONE_MODEL_SPECS, SMARTPHONE_SEED } from "@/lib/intelligence/seed/smartphones";

/** Brand -> its curated model-spec table. Extend this map, not the resolver below, when a new brand is seeded. */
const SPECS_BY_BRAND: Record<string, Record<string, Record<string, string>>> = {
  Apple: IPHONE_MODEL_SPECS,
  Samsung: GALAXY_MODEL_SPECS,
};

/**
 * Applies the curated smartphone seed (src/lib/intelligence/seed/smartphones.ts).
 * `SMARTPHONE_SEED` entries default to Apple/iPhone when brand/productFamily
 * are omitted (every pre-Galaxy row was written before either field existed).
 */
export async function applySmartphoneSeed(): Promise<{ applied: number; models: number }> {
  const seed: Record<string, SeedEntry> = Object.fromEntries(
    Object.entries(SMARTPHONE_SEED).map(([handle, entry]) => [
      handle,
      {
        shopifyProductId: entry.shopifyProductId,
        model: entry.model,
        releaseYear: entry.releaseYear,
        brand: entry.brand ?? "Apple",
        productFamily: entry.productFamily ?? "iPhone",
      },
    ]),
  );

  const { applied } = await applyCuratedSeed("smartphone", seed, (entry) => SPECS_BY_BRAND[entry.brand]?.[entry.model]);
  const modelCount = Object.values(SPECS_BY_BRAND).reduce((sum, table) => sum + Object.keys(table).length, 0);
  return { applied, models: modelCount };
}
