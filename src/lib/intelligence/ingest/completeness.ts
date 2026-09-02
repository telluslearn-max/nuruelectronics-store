import type { CategorySchema } from "@/lib/intelligence/types";

/**
 * Data completeness: the share of a category schema's attributes that have at
 * least one stored value (at any confidence). Surfaced on `ProductProfile` and
 * used to prioritise which products the sync job re-researches.
 *
 * Keys not in the schema are ignored, so passing every stored SpecValue key for
 * a product is safe.
 */
export function computeCompleteness(schema: CategorySchema, keysWithValue: Iterable<string>): number {
  if (schema.attributes.length === 0) return 0;
  const schemaKeys = new Set(schema.attributes.map((a) => a.key));
  const present = new Set([...keysWithValue].filter((k) => schemaKeys.has(k)));
  return Number((present.size / schema.attributes.length).toFixed(3));
}
