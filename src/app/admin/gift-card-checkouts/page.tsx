import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { markGiftCardCheckoutPaidByAdmin } from "@/lib/gift-card-checkout-actions";
import { formatPrice } from "@/lib/format";
import { FeedbackBanner } from "@/components/admin/feedback-banner";
import { SubmitButton } from "@/components/admin/submit-button";
import { StatusPill } from "@/components/admin/status-pill";

export const metadata: Metadata = { title: "Gift Card Checkouts" };

const inputClass =
  "w-full rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground";
const primaryButtonClass =
  "rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default async function AdminGiftCardCheckoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  await requireAdminSession();
  const { success, error } = await searchParams;

  const checkouts = await prisma.giftCardCheckout.findMany({
    where: { status: "pending" },
    include: { offering: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <h2 className="text-lg font-medium">Gift Card Checkouts</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Pending storefront checkouts awaiting M-Pesa payment. The NCBA Loop webhook confirms most of these
        automatically — use &ldquo;Mark paid &amp; fulfill&rdquo; below only when a customer has proof of payment
        (e.g. an M-Pesa message) but the automated confirmation hasn&apos;t landed.
      </p>
      <FeedbackBanner success={success} error={error} />

      <ul className="mt-6 space-y-3">
        {checkouts.map((checkout) => (
          <li key={checkout.id} className="rounded-card border border-border-subtle p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                <span className="block font-medium">{checkout.offering.displayName}</span>
                <span className="mt-1 block text-neutral-500">
                  {checkout.customerEmail} · {checkout.customerPhone} · {formatDate(checkout.createdAt)}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-lg font-semibold">{formatPrice(checkout.priceKes.toString(), "KES")}</span>
                <StatusPill status={checkout.status} />
              </span>
            </div>
            <p className="mt-2 text-neutral-500">
              Checkout code: <span className="font-mono">{checkout.checkoutCode}</span>
            </p>
            <details className="mt-3">
              <summary className="cursor-pointer font-medium">Mark paid &amp; fulfill</summary>
              <form
                action={markGiftCardCheckoutPaidByAdmin.bind(null, checkout.id)}
                className="mt-3 flex flex-wrap items-end gap-3"
              >
                <div>
                  <label className="block text-xs text-neutral-500">M-Pesa receipt code</label>
                  <input type="text" name="mpesaReceiptNumber" required className={inputClass} />
                </div>
                <SubmitButton className={primaryButtonClass} pendingText="Confirming…">
                  Mark paid &amp; fulfill
                </SubmitButton>
              </form>
            </details>
          </li>
        ))}
        {checkouts.length === 0 && <p className="text-sm text-neutral-500">No pending checkouts.</p>}
      </ul>
    </div>
  );
}
