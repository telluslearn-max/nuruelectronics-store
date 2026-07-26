/** Shared green/red tokens for positive/negative money amounts (inflows vs outflows, profit vs
    loss) — previously duplicated as slightly different literal classes (text-green-700 in one
    report, text-green-600 in another) across cash-book, PNL, and elsewhere. */
export const POSITIVE_MONEY_CLASS = "text-green-700";
export const NEGATIVE_MONEY_CLASS = "text-red-600";

export function moneyColorClass(amount: number): string {
  return amount >= 0 ? POSITIVE_MONEY_CLASS : NEGATIVE_MONEY_CLASS;
}
