import "server-only";
import { prisma } from "@/lib/prisma";
import { computeNuruScore } from "@/lib/intelligence/scoring/nuru-score";
import { resolveProductSpecs } from "@/lib/intelligence/scoring/resolve";
import type { CategorySchema } from "@/lib/intelligence/types";

/** Bump when the scoring formulas (reference bands, weights, roll-up math) change meaningfully. */
export const SCORING_FORMULA_VERSION = 1;

/**
 * Recomputes and upserts the NuruScore cache for one product from whatever
 * spec values are currently on file. Called after a sync writes new spec
 * values (see ingest/sync.ts); safe to call any time — it's a pure function
 * of what's in the database right now.
 */
export async function recomputeNuruScore(profileId: string, schema: CategorySchema): Promise<void> {
  const resolved = await resolveProductSpecs(profileId);
  const result = computeNuruScore(schema, resolved);

  await prisma.nuruScore.upsert({
    where: { profileId },
    create: {
      profileId,
      category: schema.id,
      components: result.components,
      composite: result.composite,
      scoredComponents: result.scoredComponents,
      coverage: result.coverage,
      formulaVersion: SCORING_FORMULA_VERSION,
    },
    update: {
      category: schema.id,
      components: result.components,
      composite: result.composite,
      scoredComponents: result.scoredComponents,
      coverage: result.coverage,
      formulaVersion: SCORING_FORMULA_VERSION,
      computedAt: new Date(),
    },
  });
}
