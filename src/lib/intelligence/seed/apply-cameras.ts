import "server-only";
import { applyCuratedSeed } from "@/lib/intelligence/seed/apply-shared";
import { CAMERA_MODEL_SPECS, CAMERA_SEED } from "@/lib/intelligence/seed/cameras";

/** Applies the curated camera seed (src/lib/intelligence/seed/cameras.ts). */
export async function applyCameraSeed(): Promise<{ applied: number; models: number }> {
  const { applied } = await applyCuratedSeed("camera", CAMERA_SEED, (entry) => CAMERA_MODEL_SPECS[entry.model]);
  return { applied, models: Object.keys(CAMERA_MODEL_SPECS).length };
}
