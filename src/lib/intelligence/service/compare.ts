import type { SpecConfidence } from "@prisma/client";
import { scoreAttributeValue } from "@/lib/intelligence/scoring/attribute-score";
import { SCORE_COMPONENTS, type CategorySchema, type ScoreComponent } from "@/lib/intelligence/types";

/**
 * The comparison engine (pure core).
 *
 * Given each product's resolved specs and NURU Score components, produces the
 * side-by-side a premium comparison UI renders: grouped spec rows with a
 * per-attribute winner, component-score rows with a winner, and a plain-list
 * summary of who leads each component for the narrative layer to phrase.
 *
 * A winner is only ever declared from a real, scoreable difference — an
 * attribute with no reference score (a SIM layout, a materials string) shows
 * both values and marks no winner, and a cell NURU has no verified value for
 * is null, to be rendered as "not verified", never guessed.
 */

export type CompareInputProduct = {
  handle: string;
  /** key -> resolved spec. Only keys with a value the product actually has. */
  specs: Map<string, { normalizedValue: string | null; rawValue: string; unit: string | null; confidence: SpecConfidence }>;
  components: Partial<Record<ScoreComponent, number>>;
  composite: number | null;
};

export type SpecCell = {
  rawValue: string;
  normalizedValue: string | null;
  unit: string | null;
  confidence: SpecConfidence;
  /** 0-100 if the attribute is scoreable and this value resolved, else null. */
  score: number | null;
};

export type SpecRow = {
  key: string;
  label: string;
  group: string;
  /** One entry per product, in the same order as `handles`; null where the product has no value. */
  cells: (SpecCell | null)[];
  /** Indices of the product(s) with the best score for this attribute. Empty when it isn't a scoreable difference. */
  winners: number[];
};

export type ComponentRow = {
  component: ScoreComponent;
  scores: (number | null)[];
  winners: number[];
};

export type ComparisonResult = {
  handles: string[];
  groups: { id: string; label: string; rows: SpecRow[] }[];
  components: ComponentRow[];
  composites: (number | null)[];
  compositeWinners: number[];
  /** One line per component that at least two products are scored on: who leads and by how much. */
  summary: { component: ScoreComponent; leaderHandle: string; margin: number }[];
};

/**
 * The comparison plus the per-product commercial facts the UI needs alongside
 * it (title, price, stock, image). Populated by compare-service.ts; the type
 * lives here so a client component can import it without pulling in the
 * server-only assembler.
 */
export type ComparePayload = ComparisonResult & {
  titles: string[];
  prices: ({ amount: string; currencyCode: string } | null)[];
  availability: boolean[];
  images: (string | null)[];
  /** First Shopify variant id per product, for a direct add-to-cart; null if unknown. */
  defaultVariantIds: (string | null)[];
};

/** Indices holding the maximum finite value in `values`; empty if fewer than two are finite. */
function argMax(values: (number | null | undefined)[]): number[] {
  const finite = values.map((v, i) => ({ v, i })).filter((e): e is { v: number; i: number } => typeof e.v === "number");
  if (finite.length < 2) return [];
  const max = Math.max(...finite.map((e) => e.v));
  const winners = finite.filter((e) => e.v === max).map((e) => e.i);
  // A dead-heat across every scored product isn't a "winner".
  return winners.length === finite.length ? [] : winners;
}

/** Builds the full side-by-side comparison for 2+ products of one category. */
export function buildComparison(products: CompareInputProduct[], schema: CategorySchema): ComparisonResult {
  const handles = products.map((p) => p.handle);
  const groupLabel = new Map(schema.groups.map((g) => [g.id, g.label]));

  const groups = schema.groups
    .map((group) => {
      const rows: SpecRow[] = [];
      for (const attr of schema.attributes.filter((a) => a.group === group.id)) {
        const cells: (SpecCell | null)[] = products.map((product) => {
          const spec = product.specs.get(attr.key);
          if (!spec) return null;
          const score =
            spec.normalizedValue !== null ? scoreAttributeValue(attr, spec.normalizedValue) : null;
          return {
            rawValue: spec.rawValue,
            normalizedValue: spec.normalizedValue,
            unit: spec.unit,
            confidence: spec.confidence,
            score,
          };
        });
        // Only a row worth showing: at least two products carry a value for it.
        if (cells.filter(Boolean).length < 2) continue;
        rows.push({
          key: attr.key,
          label: attr.label,
          group: group.id,
          cells,
          winners: argMax(cells.map((c) => c?.score)),
        });
      }
      return { id: group.id, label: groupLabel.get(group.id) ?? group.id, rows };
    })
    .filter((g) => g.rows.length > 0);

  const components: ComponentRow[] = [];
  const summary: ComparisonResult["summary"] = [];
  for (const component of SCORE_COMPONENTS) {
    const scores = products.map((p) => p.components[component] ?? null);
    if (scores.filter((s) => s !== null).length < 2) continue;
    const winners = argMax(scores);
    components.push({ component, scores, winners });
    if (winners.length === 1) {
      const finite = scores.filter((s): s is number => s !== null).sort((a, b) => b - a);
      summary.push({
        component,
        leaderHandle: handles[winners[0]],
        margin: Math.round((finite[0] - finite[1]) * 100) / 100,
      });
    }
  }

  return {
    handles,
    groups,
    components,
    composites: products.map((p) => p.composite),
    compositeWinners: argMax(products.map((p) => p.composite)),
    summary,
  };
}
