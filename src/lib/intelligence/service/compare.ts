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

/** One attribute a product wins decisively — the raw material for "The Fork". */
export type ForkEntry = {
  key: string;
  label: string;
  group: string;
  /** Raw display value per product, index-aligned to `handles`; null where the product has no value. */
  values: (string | null)[];
  /** The single product index that wins this attribute. */
  winner: number;
  /** 0-100 gap between the winner's attribute score and the next best — how decisive the win is. */
  gap: number;
};

/** A one-line verdict: which product to get, and the one reason you might not. */
export type Ruling = {
  /** Product index with the single highest composite NURU Score. */
  pick: number;
  /** Components the pick leads outright (may be empty if it only edges ahead on the composite). */
  leads: ScoreComponent[];
  /** A runner-up worth keeping in mind and the components it still leads; null if the pick sweeps. */
  holdout: { index: number; leads: ScoreComponent[] } | null;
};

export type ComparisonResult = {
  handles: string[];
  groups: { id: string; label: string; rows: SpecRow[] }[];
  components: ComponentRow[];
  composites: (number | null)[];
  compositeWinners: number[];
  /** One line per component that at least two products are scored on: who leads and by how much. */
  summary: { component: ScoreComponent; leaderHandle: string; margin: number }[];
  /** Per product (index-aligned to `handles`): the specs it wins by the widest scored margin, widest first. */
  fork: ForkEntry[][];
  /** A single recommendation drawn from the composite scores, or null when no product leads outright. */
  ruling: Ruling | null;
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

/** A win narrower than this in normalized points is a wash, not a fork-worthy difference. */
const FORK_MIN_GAP = 3;
/** No column of "The Fork" lists more than this — past the top few, it stops being a decision aid. */
const FORK_MAX_PER_PRODUCT = 4;

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

  const compositeWinners = argMax(products.map((p) => p.composite));

  // "The Fork": every spec one product wins outright, bucketed by winner and
  // sorted by how decisive the win is. A win only counts when at least two
  // products carry a scoreable value — "it has X, the other has no data" isn't
  // a difference a shopper can weigh.
  const forkEntries: ForkEntry[] = [];
  for (const row of groups.flatMap((g) => g.rows)) {
    if (row.winners.length !== 1) continue;
    const winner = row.winners[0];
    const scores = row.cells.map((cell) => (typeof cell?.score === "number" ? cell.score : null));
    const winnerScore = scores[winner];
    const rivalScores = scores.filter((s, i) => i !== winner && s !== null) as number[];
    if (winnerScore === null || rivalScores.length === 0) continue;
    const gap = Math.round((winnerScore - Math.max(...rivalScores)) * 100) / 100;
    if (gap < FORK_MIN_GAP) continue;
    forkEntries.push({
      key: row.key,
      label: row.label,
      group: row.group,
      values: row.cells.map((cell) => cell?.rawValue ?? null),
      winner,
      gap,
    });
  }
  const fork = handles.map((_, i) =>
    forkEntries.filter((e) => e.winner === i).sort((a, b) => b.gap - a.gap).slice(0, FORK_MAX_PER_PRODUCT),
  );

  // "The Ruling": recommend the outright composite leader, name what it wins,
  // and surface the strongest holdout — the rival that still leads the most
  // components — as the one reason a shopper might choose otherwise.
  let ruling: Ruling | null = null;
  if (compositeWinners.length === 1) {
    const pick = compositeWinners[0];
    const leads = summary.filter((s) => s.leaderHandle === handles[pick]).map((s) => s.component);
    const rivalLeads = new Map<number, ScoreComponent[]>();
    for (const s of summary) {
      const idx = handles.indexOf(s.leaderHandle);
      if (idx === pick || idx < 0) continue;
      rivalLeads.set(idx, [...(rivalLeads.get(idx) ?? []), s.component]);
    }
    let holdout: Ruling["holdout"] = null;
    for (const [index, comps] of rivalLeads) {
      if (!holdout || comps.length > holdout.leads.length) holdout = { index, leads: comps };
    }
    ruling = { pick, leads, holdout };
  }

  return {
    handles,
    groups,
    components,
    composites: products.map((p) => p.composite),
    compositeWinners,
    summary,
    fork,
    ruling,
  };
}
