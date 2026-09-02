import type { ComparePayload } from "@/lib/intelligence/service/compare";
import type { Product } from "@/lib/shopify/types";

/**
 * What the compare server action hands back. Two shapes:
 *
 *   "intelligence" — NURU has product-intelligence profiles for every handle
 *                    and they share a category: the full scored comparison.
 *   "basic"        — one or more products have no profile, the set spans
 *                    categories, or the intelligence lookup failed: fall back
 *                    to the plain Shopify spec table so the page still works.
 *
 * A `"use server"` file can only export async functions, so this type lives in
 * its own module.
 */
export type ComparisonResultView =
  | { kind: "intelligence"; payload: ComparePayload }
  | { kind: "basic"; products: Product[] }
  | { kind: "empty" };
