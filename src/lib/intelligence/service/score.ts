import "server-only";
import { getScoredCandidateByHandle } from "@/lib/intelligence/recommend/candidates";
import { computeFitScore } from "@/lib/intelligence/recommend/fit-score";
import type { FitWeights } from "@/lib/intelligence/recommend/fit-score";
import type { ScoreComponent } from "@/lib/intelligence/types";

/**
 * The NURU Score and (if the caller passes priorities) the personalized Fit
 * Score for one product. Reads the cached NuruScore row — recomputed by the
 * sync job, never on this path — and applies the weight vector.
 */

export type ProductScore = {
  handle: string;
  nuruScore: {
    composite: number | null;
    components: Partial<Record<ScoreComponent, number>>;
  };
  fit: {
    fitScore: number | null;
    coverage: number;
    weightedComponents: ScoreComponent[];
  } | null;
};

/** NURU Score for a product, plus a Fit Score when priorities are supplied. Null if the product has no computed score. */
export async function scoreProduct(handle: string, weights?: FitWeights): Promise<ProductScore | null> {
  const candidate = await getScoredCandidateByHandle(handle);
  if (!candidate) return null;

  const fit =
    weights && Object.keys(weights).length > 0
      ? (() => {
          const result = computeFitScore(candidate.components, weights);
          return {
            fitScore: result.fitScore,
            coverage: result.coverage,
            weightedComponents: result.weightedComponents,
          };
        })()
      : null;

  return {
    handle,
    nuruScore: { composite: candidate.composite, components: candidate.components },
    fit,
  };
}
