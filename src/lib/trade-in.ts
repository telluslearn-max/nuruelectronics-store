import { categoryForProductType } from "@/lib/categories";

/** Device categories the trade-in program is planned for. */
const TRADE_IN_CATEGORY_SLUGS = ["phones", "tablets", "computers", "wearables"];

export function isTradeInEligibleProduct(productType: string): boolean {
  const category = categoryForProductType(productType);
  return category !== undefined && TRADE_IN_CATEGORY_SLUGS.includes(category.slug);
}
