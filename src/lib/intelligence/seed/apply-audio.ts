import "server-only";
import { applyCuratedSeed } from "@/lib/intelligence/seed/apply-shared";
import { AUDIO_MODEL_SPECS, AUDIO_SEED } from "@/lib/intelligence/seed/audio";

/** Applies the curated audio (headphones) seed (src/lib/intelligence/seed/audio.ts). */
export async function applyAudioSeed(): Promise<{ applied: number; models: number }> {
  const { applied } = await applyCuratedSeed("audio", AUDIO_SEED, (entry) => AUDIO_MODEL_SPECS[entry.model]);
  return { applied, models: Object.keys(AUDIO_MODEL_SPECS).length };
}
