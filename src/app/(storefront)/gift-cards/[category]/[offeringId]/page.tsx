import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { priceOfferingInKes } from "@/lib/gift-card-pricing";
import { formatPrice } from "@/lib/format";
import { startGiftCardCheckout } from "@/lib/gift-card-checkout-actions";
import { DigitalDeliveryCard } from "@/components/digital-delivery-card";
import { GiftCardRegionNotice } from "@/components/gift-card-region-notice";

const inputClass =
  "mt-2 w-full rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground";

export async function generateMetadata({ params }: { params: Promise<{ offeringId: string }> }): Promise<Metadata> {
  const { offeringId } = await params;
  const offering = await prisma.giftCardOffering.findUnique({ where: { id: offeringId } });
  return { title: offering?.displayName ?? "Gift Card" };
}

export default async function GiftCardOfferingPage({
  params,
  searchParams,
}: {
  params: Promise<{ offeringId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { offeringId } = await params;
  const { error } = await searchParams;

  const [offering, settings] = await Promise.all([
    prisma.giftCardOffering.findUnique({ where: { id: offeringId } }),
    getSettings(),
  ]);

  if (!offering || !offering.published) notFound();

  const denominations = offering.denominationType === "FIXED" ? offering.fixedDenominations.map(Number) : [];

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm font-medium text-accent">Digital delivery</p>
      <h1 className="mt-2 text-title sm:text-display">{offering.displayName}</h1>
      <p className="mt-2 text-neutral-500">{offering.reloadlyCountryCode}</p>

      {error && (
        <div role="alert" className="mt-4 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form action={startGiftCardCheckout} className="mt-8 space-y-6">
        <input type="hidden" name="offeringId" value={offering.id} />

        <div>
          <label className="block text-sm font-medium">Amount</label>
          {offering.denominationType === "FIXED" ? (
            <select name="denominationAmount" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Choose an amount
              </option>
              {denominations.map((amount) => {
                let price: number | null = null;
                try {
                  price = priceOfferingInKes(offering, amount, settings);
                } catch {
                  price = null;
                }
                return (
                  <option key={amount} value={amount}>
                    {amount} {offering.reloadlyCurrencyCode}
                    {price != null ? ` — ${formatPrice(price.toString(), "KES")}` : ""}
                  </option>
                );
              })}
            </select>
          ) : (
            <input
              type="number"
              name="denominationAmount"
              required
              min={offering.minDenomination?.toString()}
              max={offering.maxDenomination?.toString()}
              step="0.01"
              placeholder={`${offering.minDenomination}–${offering.maxDenomination} ${offering.reloadlyCurrencyCode}`}
              className={inputClass}
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium">Email</label>
          <input type="email" name="customerEmail" required placeholder="you@example.com" className={inputClass} />
          <p className="mt-1 text-xs text-neutral-500">Your code is sent here, and on WhatsApp if you provide a number below.</p>
        </div>

        <div>
          <label className="block text-sm font-medium">M-Pesa phone number</label>
          <input type="tel" name="customerPhone" required placeholder="07XXXXXXXX" className={inputClass} />
        </div>

        <button
          type="submit"
          className="w-full rounded-full bg-accent px-5 py-3 text-sm font-medium text-accent-foreground transition hover:opacity-90"
        >
          Buy now
        </button>
      </form>

      <div className="mt-8">
        <DigitalDeliveryCard />
      </div>
      <GiftCardRegionNotice region={offering.reloadlyCountryCode} />
    </div>
  );
}
