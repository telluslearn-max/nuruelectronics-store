import "server-only";
import { applyCuratedSeed } from "@/lib/intelligence/seed/apply-shared";
import { TABLET_MODEL_SPECS, TABLET_SEED } from "@/lib/intelligence/seed/tablets";

/** Applies the curated tablet seed (src/lib/intelligence/seed/tablets.ts). */
export async function applyTabletSeed(): Promise<{ applied: number; models: number }> {
  const { applied } = await applyCuratedSeed("tablet", TABLET_SEED, (entry) => TABLET_MODEL_SPECS[entry.model]);
  return { applied, models: Object.keys(TABLET_MODEL_SPECS).length };
}
