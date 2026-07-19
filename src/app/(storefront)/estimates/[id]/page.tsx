import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";

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
    notFound();
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

      <p className="mt-6 text-sm">
        Status: <span className="font-medium">{isExpired ? "expired" : estimate.status}</span>
      </p>

      {canRespond ? (
        <div className="mt-8 flex gap-3">
          <form action={`/api/estimates/${estimate.id}/respond`} method="POST">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="action" value="accept" />
            <button
              type="submit"
              className="rounded-control bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
            >
              Accept
            </button>
          </form>
          <form action={`/api/estimates/${estimate.id}/respond`} method="POST">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="action" value="decline" />
            <button
              type="submit"
              className="rounded-control border border-border-subtle px-6 py-3 text-sm font-medium transition hover:border-foreground"
            >
              Decline
            </button>
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
        className="mt-8 inline-block text-sm text-neutral-500 underline hover:text-foreground"
      >
        Download PDF
      </a>
    </div>
  );
}
