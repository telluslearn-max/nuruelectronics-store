const CURRENCY_SYMBOLS: Record<string, string> = { KES: "KSh" };

/**
 * Formats money for the generated PDF documents per the brand guideline's
 * price format ("KSh 165,000", never "KES165000"). Kept separate from
 * `formatPrice` in `@/lib/format`, which is used across the storefront and
 * admin UI and must keep showing the ISO currency code there.
 */
export function formatDocumentMoney(amount: string | number, currencyCode: string): string {
  const value = Number(amount);
  const isWhole = Number.isInteger(value);
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: isWhole ? 0 : 2,
  }).format(value);
  return `${CURRENCY_SYMBOLS[currencyCode] ?? currencyCode} ${formatted}`;
}
