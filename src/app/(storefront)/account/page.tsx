import type { Metadata } from "next";
import Link from "next/link";
import { StatusPill } from "@/components/admin/status-pill";
import { WishlistSection } from "@/components/wishlist/wishlist-section";
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

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Read before the early returns below — a failed OAuth login never sets a session cookie, so
  // `customer` is always null on that path, and checking `error` after the `!customer` return
  // meant this could never actually render.
  const { error } = await searchParams;

  if (!isCustomerAuthConfigured) {
    return (
      <div>
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
        <section className="mt-12 border-t border-border-subtle pt-8">
          <WishlistSection />
        </section>
      </div>
    );
  }

  const customer = await getCurrentCustomer();
  if (!customer) {
    return (
      <div>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <h1 className="text-title">Sign in to your account</h1>
          <p className="mt-2 max-w-sm text-neutral-500">
            Sign in to see your order history and manage your account.
          </p>
          {error && (
            <p role="alert" className="mt-4 max-w-sm rounded-card border border-border-subtle bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
              Something went wrong signing you in. Please try again.
            </p>
          )}
          <a
            href="/api/auth/login"
            className="mt-8 rounded-control bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
          >
            Sign in
          </a>
        </div>
        <section className="mt-12 border-t border-border-subtle pt-8">
          <WishlistSection />
        </section>
      </div>
    );
  }

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
        <p role="alert" className="mt-6 rounded-card border border-border-subtle bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          Something went wrong signing you in. Please try again.
        </p>
      )}

      <div className="mt-10">
        <h2 className="text-lg font-medium">Order history</h2>
        {customer.orders.length === 0 ? (
          <div className="mt-3">
            <p className="text-neutral-500">You haven&apos;t placed any orders yet.</p>
            <Link
              href="/shop"
              className="mt-4 inline-block rounded-control border border-border-subtle px-5 py-2.5 text-sm font-medium transition hover:border-foreground"
            >
              Browse products
            </Link>
          </div>
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
                    <div className="mt-1">
                      <StatusPill status={order.fulfillmentStatus.toLowerCase()} />
                    </div>
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

      <section className="mt-12 border-t border-border-subtle pt-8">
        <WishlistSection />
      </section>
    </div>
  );
}
