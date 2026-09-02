import { smartphoneSchema } from "@/lib/intelligence/schema/smartphone";
import type { CategorySchema, SpecAttribute } from "@/lib/intelligence/types";

/**
 * The category schema registry. Adding a category is: write its schema module,
 * add it here. The engine, the comparison UI, the ingestion pipeline and the
 * WebMCP tools all read categories through this file — none of them hard-code a
 * category id beyond what a caller passes in.
 */
const SCHEMAS: Record<string, CategorySchema> = {
  [smartphoneSchema.id]: smartphoneSchema,
};

/** The schema for a category id ("smartphone"), or null if the category is unknown. */
export function getCategorySchema(id: string): CategorySchema | null {
  return SCHEMAS[id] ?? null;
}

/** Every registered category schema. */
export function listCategorySchemas(): CategorySchema[] {
  return Object.values(SCHEMAS);
}

/** Resolve a Shopify `product_type` to the category schema that covers it, if any. */
export function schemaForShopifyProductType(productType: string): CategorySchema | null {
  const wanted = productType.trim().toLowerCase();
  return (
    listCategorySchemas().find((schema) =>
      schema.shopifyProductTypes.some((t) => t.toLowerCase() === wanted),
    ) ?? null
  );
}

/** One attribute from a schema by its key, or null if the schema has no such attribute. */
export function getAttribute(schema: CategorySchema, key: string): SpecAttribute | null {
  return schema.attributes.find((a) => a.key === key) ?? null;
}

/** Attribute keys that feed a NURU Score component (i.e. have a `scoring` block). */
export function scoredAttributeKeys(schema: CategorySchema): string[] {
  return schema.attributes.filter((a) => a.scoring).map((a) => a.key);
}
