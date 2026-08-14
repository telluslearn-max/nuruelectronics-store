import "server-only";
import type { GiftCardOffering, Settings } from "@prisma/client";

/** Hard business floor — see the "20% minimum markup" scoping decision. Never a UI default staff can undercut. */
export const MINIMUM_MARKUP_PERCENT = 20;

export function clampMarkupPercent(markupPercent: number): number {
  return Math.max(markupPercent, MINIMUM_MARKUP_PERCENT);
}

/**
 * KES price for a denomination of a published offering. Reloadly denominates most non-KES cards in
 * USD, so a non-"KES" `reloadlyCurrencyCode` is converted via `settings.usdToKesRate` (kept fresh by the
 * daily sync-fx-rate cron) — this app only tracks a single USD→KES rate, so a currency that's neither KES
 * nor (implicitly) USD isn't supported yet.
 */
export function priceOfferingInKes(
  offering: Pick<GiftCardOffering, "reloadlyCurrencyCode" | "markupPercent">,
  denominationAmount: number,
  settings: Pick<Settings, "usdToKesRate">,
): number {
  const markupPercent = clampMarkupPercent(Number(offering.markupPercent));

  let amountInKes = denominationAmount;
  if (offering.reloadlyCurrencyCode !== "KES") {
    if (!settings.usdToKesRate) {
      throw new Error(
        `No FX rate loaded yet — can't price a ${offering.reloadlyCurrencyCode} offering in KES until the sync-fx-rate cron has run at least once.`,
      );
    }
    amountInKes = denominationAmount * Number(settings.usdToKesRate);
  }

  return Math.round(amountInKes * (1 + markupPercent / 100));
}
