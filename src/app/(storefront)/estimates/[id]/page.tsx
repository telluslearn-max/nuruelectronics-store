import type { Metadata } from "next";
import { StatusPill } from "@/components/admin/status-pill";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { DownloadIcon } from "@/components/download-icon";
import { WhatsAppIcon } from "@/components/whatsapp-order-button";
import { formatPrice } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Estimate",
  robots: { index: false, follow: false },
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

function isPastValidity(validUntil: Date) {
  return validUntil.getTime() < Date.now();
}

export default async function PublicEstimatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;

  const estimate = await prisma.estimate.findUnique({
    where: { id },
    include: { order: { include: { customer: true, items: true } } },
  });

  if (!estimate || !token || estimate.accessToken !== token) {
    const href = buildWhatsAppUrl(
      "Hi! I'm having trouble accessing my estimate link — could you help me get a new one?",
    );
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-title">Estimate link not found</h1>
        <p className="mt-3 text-neutral-500">
          This link may be invalid, expired, or already used. Contact us and we can send you a new one.
        </p>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-control bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition hover:opacity-90"
          >
            <WhatsAppIcon className="h-4 w-4" />
            Message us on WhatsApp
          </a>
        )}
      </div>
    );
  }

  const isExpired = isPastValidity(estimate.validUntil) && estimate.status !== "accepted" && estimate.status !== "declined";
  const canRespond = (estimate.status === "draft" || estimate.status === "sent") && !isExpired;
  const formatMoney = (amount: string) => formatPrice(amount, estimate.order.currencyCode);

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-title">Estimate {estimate.number}</h1>
      <p className="mt-2 text-neutral-500">
        Prepared for {estimate.order.customer.name ?? estimate.order.customer.email} · Valid until{" "}
        {formatDate(estimate.validUntil)}
      </p>

      <ul className="mt-8 space-y-3">
        {estimate.order.items.map((item) => (
          <li key={item.id} className="flex justify-between rounded-card border border-border-subtle p-4 text-sm">
            <span>
              {item.title} × {item.quantity}
            </span>
            <span>{formatMoney(item.lineTotal.toString())}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 space-y-1 text-right text-sm text-neutral-600">
        <p>Subtotal: {formatMoney(estimate.subtotal.toString())}</p>
        <p>Tax: {formatMoney(estimate.taxTotal.toString())}</p>
        <p>Shipping: {formatMoney(estimate.shippingTotal.toString())}</p>
        <p>Discount: -{formatMoney(estimate.discountTotal.toString())}</p>
        <p className="text-lg font-medium text-foreground">Total: {formatMoney(estimate.total.toString())}</p>
      </div>

      <div className="mt-6 flex items-center gap-2 text-sm">
        <span>Status:</span>
        <StatusPill status={isExpired ? "expired" : estimate.status} />
      </div>

      {canRespond ? (
        <div className="mt-8 flex gap-3">
          <form action={`/api/estimates/${estimate.id}/respond`} method="POST">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="action" value="accept" />
            <ConfirmSubmitButton
              confirmMessage="Accept this estimate? We'll be in touch to arrange next steps."
              className="rounded-control bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
            >
              Accept
            </ConfirmSubmitButton>
          </form>
          <form action={`/api/estimates/${estimate.id}/respond`} method="POST">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="action" value="decline" />
            <ConfirmSubmitButton
              confirmMessage="Decline this estimate? This can't be undone."
              className="rounded-control border border-border-subtle px-6 py-3 text-sm font-medium transition hover:border-foreground"
            >
              Decline
            </ConfirmSubmitButton>
          </form>
        </div>
      ) : (
        <p className="mt-8 text-neutral-500">
          {estimate.status === "accepted" && "You've accepted this estimate. We'll be in touch."}
          {estimate.status === "declined" && "You've declined this estimate."}
          {isExpired && estimate.status !== "accepted" && estimate.status !== "declined" && "This estimate has expired."}
        </p>
      )}

      <a
        href={`/api/estimates/${estimate.id}/pdf?token=${token}`}
        className="mt-8 inline-flex items-center gap-1.5 text-sm text-neutral-500 underline hover:text-foreground"
      >
        <DownloadIcon className="h-4 w-4" />
        Download PDF
      </a>
    </div>
  );
}
