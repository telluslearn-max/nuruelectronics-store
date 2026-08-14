import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { GiftCardCheckoutStatusPoller } from "@/components/gift-card-checkout-status";

export const metadata: Metadata = { title: "Complete Your Payment" };

// NCBA's shared Paybill for M-Pesa collections — a fixed, public business number, not a secret.
const NCBA_PAYBILL = "880100";

export default async function GiftCardCheckoutPage({ params }: { params: Promise<{ checkoutId: string }> }) {
  const { checkoutId } = await params;

  const checkout = await prisma.giftCardCheckout.findUnique({
    where: { id: checkoutId },
    include: { offering: true, order: { include: { items: { include: { giftCardFulfillment: true } } } } },
  });
  if (!checkout) notFound();

  const accountNumber = process.env.NCBA_ACCOUNT_NUMBER;
  const whatsappUrl = buildWhatsAppUrl(
    `Hi! I've paid for a ${checkout.offering.displayName} gift card. My checkout reference is ${checkout.checkoutCode}.`,
  );
  const fulfillment = checkout.order?.items[0]?.giftCardFulfillment ?? null;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-title sm:text-display">Complete Your Payment</h1>
      <p className="mt-2 text-neutral-500">
        {checkout.offering.displayName} · {formatPrice(checkout.priceKes.toString(), "KES")}
      </p>

      {checkout.status === "pending" && (
        <div className="mt-6 rounded-card border border-border-subtle p-5">
          <h2 className="font-medium">Pay via M-Pesa</h2>
          <ol className="mt-3 space-y-2 text-sm text-neutral-600">
            <li>
              1. Open M-Pesa on your phone, choose <strong>Lipa na M-Pesa</strong> → <strong>Pay Bill</strong>.
            </li>
            <li>
              2. Business Number: <span className="font-mono font-semibold text-foreground">{NCBA_PAYBILL}</span>
            </li>
            <li>
              3. Account Number: <span className="font-mono font-semibold text-foreground">{accountNumber ?? "—"}</span>
            </li>
            <li>
              4. Amount: <span className="font-semibold text-foreground">{formatPrice(checkout.priceKes.toString(), "KES")}</span>
            </li>
            <li>
              5. Reference: <span className="font-mono font-semibold text-foreground">{checkout.checkoutCode}</span>
            </li>
          </ol>
          <p className="mt-3 text-xs text-neutral-500">
            Use the reference exactly as shown above — it&apos;s how we match your payment to this order.
          </p>
        </div>
      )}

      <GiftCardCheckoutStatusPoller
        checkoutId={checkout.id}
        whatsappUrl={whatsappUrl}
        initialStatus={{
          checkoutStatus: checkout.status,
          fulfillmentStatus: fulfillment?.status ?? null,
          cardNumber: fulfillment?.status === "completed" ? fulfillment.cardNumber : null,
          pinCode: fulfillment?.status === "completed" ? fulfillment.pinCode : null,
        }}
      />
    </div>
  );
}
