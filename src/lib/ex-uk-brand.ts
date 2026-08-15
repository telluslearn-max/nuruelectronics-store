import type { Product } from "@/lib/shopify/types";

export type PhoneBrand = "iphone" | "android";

/**
 * Best-effort brand classification for the Ex-UK deck's iPhone/Android split. Vendor is set on
 * every listing going forward (see the ex-uk product creation flow), but falls back to the title
 * for older listings that predate consistent vendor tagging.
 */
export function brandForProduct(product: Pick<Product, "vendor" | "title">): PhoneBrand {
  const vendor = product.vendor?.toLowerCase() ?? "";
  if (vendor.includes("apple")) return "iphone";
  if (vendor.includes("samsung")) return "android";
  return product.title.toLowerCase().includes("iphone") ? "iphone" : "android";
}
