import type { Metadata } from "next";
import Link from "next/link";
import { StatusPill } from "@/components/admin/status-pill";
import { WhatsAppIcon } from "@/components/whatsapp-order-button";
import { formatPrice } from "@/lib/format";
import { getCurrentCustomer } from "@/lib/customer";
import { isCustomerAuthConfigured } from "@/lib/customer-auth";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Order",
  robots: { index: false, follow: false },
};

function formatOrderDate(dateString: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(dateString));
}

function SignInPrompt({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h1 className="text-title">{title}</h1>
      <p className="mt-2 max-w-sm text-neutral-500">{message}</p>
      <Link
        href="/account"
        className="mt-8 rounded-control bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
      >
        Back to account
      </Link>
    </div>
  );
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);

  if (!isCustomerAuthConfigured) {
    return (
      <SignInPrompt
        title="Sign-in isn't available yet"
        message="Customer accounts are being set up. Check back soon."
      />
    );
  }

  const customer = await getCurrentCustomer();
  if (!customer) {
    return (
      <SignInPrompt
        title="Sign in to view this order"
        message="Sign in to see your order details."
      />
    );
  }

  const order = customer.orders.find((o) => o.id === decodedId);
  const whatsappHref = buildWhatsAppUrl(
    order
      ? `Hi! I have a question about my order ${order.name}.`
      : "Hi! I have a question about an order I placed.",
  );

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h1 className="text-title">Order not found</h1>
        <p className="mt-2 max-w-sm text-neutral-500">
          We couldn&apos;t find that order on your account. If you think this is a mistake, message
          us and we&apos;ll look it up.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/account"
            className="rounded-control border border-border-subtle px-6 py-3 text-sm font-medium transition hover:border-foreground"
          >
            Back to account
          </Link>
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-control bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition hover:opacity-90"
            >
              <WhatsAppIcon className="h-4 w-4 shrink-0" />
              Message us
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/account" className="text-sm text-neutral-500 hover:text-foreground">
        ← Back to account
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-title">{order.name}</h1>
          <p className="mt-2 text-neutral-500">{formatOrderDate(order.processedAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill status={order.fulfillmentStatus.toLowerCase()} />
          {order.financialStatus && <StatusPill status={order.financialStatus.toLowerCase()} />}
        </div>
      </div>

      <div className="mt-8 rounded-card border border-border-subtle p-6">
        <h2 className="text-sm font-medium text-neutral-500">Items</h2>
        <ul className="mt-3 divide-y divide-border-subtle">
          {order.lineItems.map((li, index) => (
            <li key={index} className="flex items-center justify-between py-3 text-sm">
              <span>{li.title}</span>
              <span className="text-neutral-500">× {li.quantity}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-4 font-medium">
          <span>Total</span>
          <span>{formatPrice(order.totalPrice.amount, order.totalPrice.currencyCode)}</span>
        </div>
      </div>

      <div className="mt-8 rounded-card bg-neutral-50 p-6 text-center">
        <h2 className="text-sm font-semibold">Questions about this order?</h2>
        <p className="mt-1 text-sm text-neutral-500">
          For delivery tracking, changes, or anything else, message us on WhatsApp.
        </p>
        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90"
          >
            <WhatsAppIcon className="h-4 w-4 shrink-0" />
            Message us on WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
