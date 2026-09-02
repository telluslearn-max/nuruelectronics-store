import { scoreAttributeValue } from "@/lib/intelligence/scoring/attribute-score";
import { SCORE_COMPONENTS, type CategorySchema, type ScoreComponent } from "@/lib/intelligence/types";

/**
 * The NURU Score engine: deterministic component scores (0-100) and a
 * composite for one product, rolled up from whatever normalized specs it
 * actually has on file. Pure — takes the product's resolved spec values,
 * returns numbers, touches nothing.
 *
 * The one rule everything else here serves: **missing data lowers coverage,
 * never the score.** An attribute NURU has no verified value for is left out
 * of its component's weighted average entirely (the remaining attributes'
 * weights are renormalised to fill the gap) rather than treated as a zero or
 * guessed at. The same renormalisation happens one level up, across
 * components, for the composite. A product that's missing camera data
 * doesn't get penalised for it — it gets a Camera score NURU is honest about
 * not having, and a composite computed from the components it does have.
 *
 * `coverage` reports, per component, what share of its defined weight was
 * actually backed by a resolved value — the input the UI/explanation layer
 * uses to say "this score is based on 3 of 5 known factors" rather than
 * present every number with equal confidence.
 */

export type ResolvedSpec = { key: string; normalizedValue: string };

export type ComponentCoverage = { scoredWeight: number; totalWeight: number };

export type NuruScoreResult = {
  /** Only components with at least one scoreable attribute. */
  components: Partial<Record<ScoreComponent, number>>;
  scoredComponents: ScoreComponent[];
  /** Null when nothing on the product could be scored at all. */
  composite: number | null;
  coverage: Partial<Record<ScoreComponent, ComponentCoverage>>;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Component scores, composite, and coverage for one product's resolved spec values. See module doc above. */
export function computeNuruScore(schema: CategorySchema, resolved: ResolvedSpec[]): NuruScoreResult {
  const valueByKey = new Map(resolved.map((r) => [r.key, r.normalizedValue]));

  const components: Partial<Record<ScoreComponent, number>> = {};
  const coverage: Partial<Record<ScoreComponent, ComponentCoverage>> = {};

  for (const component of SCORE_COMPONENTS) {
    const attrs = schema.attributes.filter((a) => a.scoring?.component === component);
    if (attrs.length === 0) continue;

    const totalWeight = attrs.reduce((sum, a) => sum + (a.scoring?.weight ?? 0), 0);
    let scoredWeight = 0;
    let weightedSum = 0;

    for (const attr of attrs) {
      const value = valueByKey.get(attr.key);
      if (value === undefined) continue;
      const score = scoreAttributeValue(attr, value);
      if (score === null) continue;
      const weight = attr.scoring?.weight ?? 0;
      scoredWeight += weight;
      weightedSum += weight * score;
    }

    coverage[component] = { scoredWeight, totalWeight };
    if (scoredWeight > 0) components[component] = round2(weightedSum / scoredWeight);
  }

  const scoredComponents = SCORE_COMPONENTS.filter((c) => components[c] !== undefined);

  let composite: number | null = null;
  if (scoredComponents.length > 0) {
    const presentWeight = scoredComponents.reduce((sum, c) => sum + schema.componentWeights[c], 0);
    if (presentWeight > 0) {
      const weightedComposite = scoredComponents.reduce(
        (sum, c) => sum + (schema.componentWeights[c] / presentWeight) * (components[c] ?? 0),
        0,
      );
      composite = round2(weightedComposite);
    }
  }

  return { components, scoredComponents, composite, coverage };
}
