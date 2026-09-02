"use server";

import { compareByHandles } from "@/lib/intelligence/service/compare-service";
import { getProductsByHandles } from "@/lib/actions";
import type { ComparisonResultView } from "@/components/compare/comparison-result";

/**
 * The compare page's data loader. Tries the scored product-intelligence
 * comparison first; falls back to the plain Shopify spec table whenever that
 * isn't possible (no profiles yet, mixed categories, database unavailable) so
 * the page degrades instead of breaking — the same graceful-degradation rule
 * the rest of the storefront follows.
 */
export async function loadComparison(handles: string[]): Promise<ComparisonResultView> {
  const clean = [...new Set(handles.map((h) => h.trim()).filter(Boolean))].slice(0, 4);
  if (clean.length < 2) return { kind: "empty" };

  try {
    const payload = await compareByHandles(clean);
    if (payload) return { kind: "intelligence", payload };
  } catch (error) {
    console.error("[compare] intelligence comparison failed, falling back to basic:", error);
  }

  const products = await getProductsByHandles(clean);
  return { kind: "basic", products };
}
