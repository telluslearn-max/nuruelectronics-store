import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatPrice } from "@/lib/format";
import { getCurrentCustomer } from "@/lib/customer";
import { isCustomerAuthConfigured } from "@/lib/customer-auth";

export const metadata: Metadata = {
  title: "My Account",
  robots: { index: false, follow: false },
};

function formatOrderDate(dateString: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(dateString));
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!isCustomerAuthConfigured) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h1 className="text-title">Sign-in isn&apos;t available yet</h1>
        <p className="mt-2 max-w-sm text-neutral-500">
          Customer accounts are being set up. Check back soon.
        </p>
        <Link
          href="/"
          className="mt-8 rounded-control bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
        >
          Back to shop
        </Link>
      </div>
    );
  }

  const customer = await getCurrentCustomer();
  if (!customer) {
    redirect("/api/auth/login");
  }

  const { error } = await searchParams;

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-title">My Account</h1>
          <p className="mt-2 text-neutral-500">
            {customer.displayName}
            {customer.email ? ` · ${customer.email}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          <Link
            href="/account/documents"
            className="rounded-control border border-border-subtle px-4 py-2 text-sm font-medium transition hover:border-foreground"
          >
            My Documents
          </Link>
          <a
            href="/api/auth/logout"
            className="rounded-control border border-border-subtle px-4 py-2 text-sm font-medium transition hover:border-foreground"
          >
            Log out
          </a>
        </div>
      </div>

      {error && (
        <p className="mt-6 rounded-card border border-border-subtle bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          Something went wrong signing you in. Please try again.
        </p>
      )}

      <div className="mt-10">
        <h2 className="text-lg font-medium">Order history</h2>
        {customer.orders.length === 0 ? (
          <p className="mt-3 text-neutral-500">You haven&apos;t placed any orders yet.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {customer.orders.map((order) => (
              <li key={order.id} className="rounded-card border border-border-subtle p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{order.name}</p>
                    <p className="text-sm text-neutral-500">{formatOrderDate(order.processedAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {formatPrice(order.totalPrice.amount, order.totalPrice.currencyCode)}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {formatStatus(order.fulfillmentStatus)}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-neutral-600">
                  {order.lineItems.map((li) => `${li.title} × ${li.quantity}`).join(", ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
