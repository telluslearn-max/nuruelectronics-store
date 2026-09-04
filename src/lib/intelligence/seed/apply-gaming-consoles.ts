import "server-only";
import { applyCuratedSeed } from "@/lib/intelligence/seed/apply-shared";
import { GAMING_CONSOLE_MODEL_SPECS, GAMING_CONSOLE_SEED } from "@/lib/intelligence/seed/gaming-consoles";

/** Applies the curated gaming console seed (src/lib/intelligence/seed/gaming-consoles.ts). */
export async function applyGamingConsoleSeed(): Promise<{ applied: number; models: number }> {
  const { applied } = await applyCuratedSeed("gaming_console", GAMING_CONSOLE_SEED, (entry) => GAMING_CONSOLE_MODEL_SPECS[entry.model]);
  return { applied, models: Object.keys(GAMING_CONSOLE_MODEL_SPECS).length };
}
