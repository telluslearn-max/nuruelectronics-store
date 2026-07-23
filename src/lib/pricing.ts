import type { Money } from "./shopify/types";

export type Savings = { save: Money; percent: number };

/** Never fabricates a discount: null unless compareAtPrice is present and strictly greater than price. */
export function getSavings(price: Money, compareAtPrice: Money | null | undefined): Savings | null {
  if (!compareAtPrice) return null;
  const priceAmount = Number(price.amount);
  const compareAmount = Number(compareAtPrice.amount);
  if (!(compareAmount > priceAmount)) return null;
  return {
    save: { amount: (compareAmount - priceAmount).toFixed(2), currencyCode: price.currencyCode },
    percent: Math.round(((compareAmount - priceAmount) / compareAmount) * 100),
  };
}
