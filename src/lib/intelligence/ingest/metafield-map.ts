import type { ProductSpec } from "@/lib/shopify/types";
import { getCategorySchema } from "@/lib/intelligence/schema";
import { normalizeSpec } from "@/lib/intelligence/normalize";
import type { CategorySchema } from "@/lib/intelligence/types";

/**
 * Mapping from Shopify `specs`-namespace metafield keys to category-schema
 * attribute keys.
 *
 * The Shopify metafields are generic and often compound ("50MP triple camera",
 * "6.7-inch AMOLED 120Hz"); the schema attributes are specific and single-
 * valued. A pair only appears here when the normalizer can be trusted to pull
 * the right number out of the metafield's usual phrasing — everything else is
 * deliberately left for the AI grounded pass rather than mapped and silently
 * mis-parsed. Notable omissions:
 *
 *   battery       usually "Up to 23h video playback" — a runtime claim, not mAh.
 *   connectivity  usually a Bluetooth version — no schema attribute for it.
 *   dimensions    three numbers; the schema has no combined dimensions field.
 */
const METAFIELD_TO_SCHEMA: Record<string, Record<string, string>> = {
  smartphone: {
    processor: "chipset",
    ram: "ram_gb",
    storage: "storage_gb",
    os: "os",
    display: "display_size_in",
    resolution: "display_resolution",
    camera: "main_cam_mp",
    water_resistance: "ip_rating",
    weight: "weight_g",
  },
};

export type MappedMetafieldValue = {
  /** Category-schema attribute key. */
  key: string;
  /** The metafield's raw string, unchanged. */
  rawValue: string;
  /** Normalizer output, or null when the phrasing didn't parse. */
  normalizedValue: string | null;
  unit: string | null;
};

/**
 * Turns one product's Shopify `specs` metafields into normalized schema values.
 * Metafields with no safe mapping, or whose value is blank, are dropped.
 * Metafields that map but don't normalize are kept with `normalizedValue: null`
 * so ingestion can still record the raw string and flag it.
 */
export function mapMetafields(categoryId: string, metafields: ProductSpec[]): MappedMetafieldValue[] {
  const schema = getCategorySchema(categoryId);
  const table = METAFIELD_TO_SCHEMA[categoryId];
  if (!schema || !table) return [];

  const out: MappedMetafieldValue[] = [];
  const seen = new Set<string>();
  for (const { key, value } of metafields) {
    const schemaKey = table[key];
    if (!schemaKey || seen.has(schemaKey) || !value?.trim()) continue;
    const attr = attributeByKey(schema, schemaKey);
    if (!attr) continue;
    const normalized = normalizeSpec(attr, value);
    if (normalized === null) continue; // blank / no-data marker
    seen.add(schemaKey);
    out.push({ key: schemaKey, rawValue: value.trim(), ...normalized });
  }
  return out;
}

function attributeByKey(schema: CategorySchema, key: string) {
  return schema.attributes.find((a) => a.key === key) ?? null;
}
