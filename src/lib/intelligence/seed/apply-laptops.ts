import "server-only";
import { applyCuratedSeed } from "@/lib/intelligence/seed/apply-shared";
import { LAPTOP_MODEL_SPECS, LAPTOP_SEED } from "@/lib/intelligence/seed/laptops";

/** Applies the curated laptop seed (src/lib/intelligence/seed/laptops.ts). */
export async function applyLaptopSeed(): Promise<{ applied: number; models: number }> {
  const { applied } = await applyCuratedSeed("laptop", LAPTOP_SEED, (entry) => LAPTOP_MODEL_SPECS[entry.model]);
  return { applied, models: Object.keys(LAPTOP_MODEL_SPECS).length };
}
