import "server-only";
import { computeSavings, findCounterpart } from "@/lib/product-match";
import { getProductByHandle } from "@/lib/shopify";
import type { Money } from "@/lib/shopify/types";

export type ExUkSavingsResult =
  | {
      exUkHandle: string;
      exUkTitle: string;
      exUkPrice: Money;
      newHandle: string;
      newTitle: string;
      newPrice: Money;
      savings: { amount: string; currencyCode: string; percent: number } | null;
    }
  | { error: string };

/**
 * Backs the concierge's `get_ex_uk_savings` tool, reusing the same matching/savings logic as the
 * rest of the site (src/lib/product-match.ts) so the AI cites a real, exact savings figure instead
 * of guessing — works from either the Ex-UK unit's handle or the equivalent new listing's handle.
 */
export async function getExUkSavings(handle: string): Promise<ExUkSavingsResult> {
  const product = await getProductByHandle(handle);
  if (!product) return { error: "Product not found." };

  const isExUk = product.tags.includes("ex-uk");
  const [exUkProduct, newProduct] = isExUk
    ? [product, await findCounterpart(product, { requireExUk: false })]
    : [await findCounterpart(product, { requireExUk: true }), product];

  if (!exUkProduct || !newProduct) {
    return { error: "No matching Ex-UK/new-unit counterpart found for this product." };
  }

  const exUkPrice = exUkProduct.priceRange.minVariantPrice;
  const newPrice = newProduct.priceRange.minVariantPrice;

  return {
    exUkHandle: exUkProduct.handle,
    exUkTitle: exUkProduct.title,
    exUkPrice,
    newHandle: newProduct.handle,
    newTitle: newProduct.title,
    newPrice,
    savings: computeSavings(exUkPrice.amount, newPrice.amount, exUkPrice.currencyCode),
  };
}
