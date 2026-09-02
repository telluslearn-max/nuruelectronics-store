import { SCORE_COMPONENTS, type ScoreComponent } from "@/lib/intelligence/types";
import type { FitWeights } from "@/lib/intelligence/recommend/fit-score";

/**
 * Shared request-parsing helpers for the /api/products/* routes. Kept
 * permissive: an unrecognised component or a non-numeric weight is dropped, not
 * a 400 — the Fit Score math already tolerates a sparse or empty vector.
 */

const COMPONENT_SET = new Set<string>(SCORE_COMPONENTS);

/** Accepts an object ({ camera: 4 }), or a compact string ("camera:4,battery:3"). */
export function parseWeights(input: unknown): FitWeights {
  const weights: FitWeights = {};
  if (input && typeof input === "object" && !Array.isArray(input)) {
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      const n = Number(value);
      if (COMPONENT_SET.has(key) && Number.isFinite(n) && n > 0) weights[key as ScoreComponent] = n;
    }
  } else if (typeof input === "string") {
    for (const pair of input.split(",")) {
      const [key, raw] = pair.split(":").map((s) => s.trim());
      const n = Number(raw);
      if (COMPONENT_SET.has(key) && Number.isFinite(n) && n > 0) weights[key as ScoreComponent] = n;
    }
  }
  return weights;
}

/** A finite positive number from a query string or JSON value, else undefined. */
export function positiveNumber(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
