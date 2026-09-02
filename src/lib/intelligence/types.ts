/**
 * Product Intelligence Layer — shared types.
 *
 * The layer's job is to turn the scattered, differently-worded specifications a
 * product picks up from manufacturers, suppliers and Shopify metafields into
 * one machine-readable record per product that a deterministic engine can score
 * and compare. This file holds the vocabulary the rest of `src/lib/intelligence/`
 * is built on; none of it touches Prisma, the network, or an LLM.
 *
 * The organising rule (from the build brief): data flows
 *   source → normalize → deterministic engine → structured result → AI narration
 * never
 *   user → LLM → invented product facts.
 */

/** The eight component scores every category rolls a NURU Score up from. */
export type ScoreComponent =
  | "performance"
  | "camera"
  | "battery"
  | "display"
  | "build"
  | "features"
  | "software"
  | "value";

export const SCORE_COMPONENTS: readonly ScoreComponent[] = [
  "performance",
  "camera",
  "battery",
  "display",
  "build",
  "features",
  "software",
  "value",
] as const;

/**
 * How the raw string for an attribute is read. Each id maps to one pure
 * function in `normalize.ts`. Kept as a closed union so the category schemas
 * can't reference a normalizer that doesn't exist.
 */
export type NormalizerId =
  /** A number with a unit: "120Hz", "up to 120 Hz", "5000 mAh" → the number, in the attribute's `unit`. */
  | "quantity"
  /** A storage/memory capacity: "256GB", "1 TB", "512 GB" → whole gigabytes. */
  | "storage"
  /** A yes/no field: "Yes", "✓", "Optional", "—", "N/A" → "true" / "false" / null. */
  | "boolean"
  /** One of a fixed set of tokens, matched through a synonym table. */
  | "enum"
  /** A system-on-chip name: "SD 8 Gen 3", "Qualcomm Snapdragon 8 Gen 3" → "Snapdragon 8 Gen 3". */
  | "chipset"
  /** A pixel resolution: "2340 x 1080 pixels" → "2340x1080". */
  | "resolution"
  /** Free text kept as-is, only trimmed and whitespace-collapsed. */
  | "passthrough";

export type SpecValueType = "number" | "integer" | "boolean" | "enum" | "text";

/** Scoring metadata for one attribute — consumed by the NURU Score engine (later PR). */
export type SpecScoring = {
  component: ScoreComponent;
  /** Relative weight of this attribute inside its component. Arbitrary positive scale. */
  weight: number;
  /** True when a larger normalized number is the better product (mAh: yes; weight_g: no). */
  higherIsBetter: boolean;
};

export type SpecAttribute = {
  /** Stable key — the SpecValue.key, the CSV column header, and the schema lookup key. */
  key: string;
  label: string;
  /** One-line buyer-facing explanation of why this spec matters. */
  hint?: string;
  valueType: SpecValueType;
  /** Canonical unit the normalizer targets, for `number`/`integer` attributes. */
  unit?: string;
  normalizer: NormalizerId;
  /** Allowed canonical tokens, for `enum` attributes. The first is treated as the "lowest". */
  enumValues?: string[];
  /** Ordered best→worst, for `enum` attributes that feed a score. */
  enumRank?: string[];
  /** Comparison-UI grouping (matches a `CategorySchema.groups` id). */
  group: string;
  /** Null for identity/descriptive attributes that don't feed any score. */
  scoring?: SpecScoring;
};

export type CategorySchema = {
  /** e.g. "smartphone" — also the `ProductProfile.category` value. */
  id: string;
  label: string;
  /** Shopify `product_type` values that route a product to this schema. */
  shopifyProductTypes: string[];
  groups: { id: string; label: string }[];
  attributes: SpecAttribute[];
  /**
   * Weight of each component in the composite NURU Score. Must sum to 1.
   * Consumed by the scoring engine; validated in the schema's own test.
   */
  componentWeights: Record<ScoreComponent, number>;
};

/** The result of normalizing one raw spec string. */
export type NormalizedSpec = {
  /**
   * Machine-readable form: a decimal string for numbers ("120"), "true"/"false"
   * for booleans, the canonical token for enums, trimmed text for passthrough.
   * Null means the raw value was present but could not be understood — which is
   * a different, louder signal than the attribute simply being absent.
   */
  normalizedValue: string | null;
  /** Canonical unit, or null for unitless / enum / boolean / text attributes. */
  unit: string | null;
};
