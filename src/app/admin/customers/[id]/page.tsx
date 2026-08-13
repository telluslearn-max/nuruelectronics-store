import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-auth";
import { getCustomerInsights, LIFECYCLE_LABELS } from "@/lib/customer-insights";
import { prisma } from "@/lib/prisma";
import { updateCustomer } from "@/lib/customer-actions";
import { FeedbackBanner } from "@/components/admin/feedback-banner";
import { StatusPill } from "@/components/admin/status-pill";

export const metadata: Metadata = { title: "Customer" };

const inputClass =
  "w-full rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground";
const primaryButtonClass =
  "rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

export default async function AdminCustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  await requireAdminSession();
  const { id } = await params;
  const { success, error } = await searchParams;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        include: { invoice: true, estimates: true, deliveryNote: true },
      },
      referredBy: true,
    },
  });

  if (!customer) notFound();

  const insights = await getCustomerInsights(customer.id, customer.orders.length, customer.orders[0]?.createdAt ?? null);
  const interestTags = Array.from(
    new Set(
      insights.recentInteractions.flatMap((interaction) =>
        [interaction.inferredCategory, interaction.inferredIntent, interaction.inferredBudgetSignal].filter(
          (value): value is string => Boolean(value),
        ),
      ),
    ),
  ).slice(0, 8);

  return (
    <div>
      <Link href="/admin/customers" className="text-sm text-neutral-500 hover:text-foreground">
        &larr; Back to Customers
      </Link>
      <h2 className="mt-2 text-lg font-medium">{customer.name ?? customer.email}</h2>
      <FeedbackBanner success={success} error={error} />

      <details className="mt-6" open>
        <summary className="cursor-pointer text-sm font-medium">Contact details</summary>
        <form action={updateCustomer.bind(null, customer.id)} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-neutral-500">Name</label>
            <input type="text" name="name" defaultValue={customer.name ?? ""} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Email</label>
            <input type="email" name="email" required defaultValue={customer.email} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Phone</label>
            <input type="text" name="phone" defaultValue={customer.phone ?? ""} className={inputClass} />
          </div>
          <div className="flex items-end sm:col-span-2">
            <button type="submit" className={`${primaryButtonClass} w-full sm:w-auto`}>
              Save
            </button>
          </div>
        </form>
        <p className="mt-4 text-xs text-neutral-500">
          Referral code: <span className="font-mono">{customer.referralCode}</span>
          {customer.referredBy && (
            <>
              {" "}
              · Referred by {customer.referredBy.name ?? customer.referredBy.email}
            </>
          )}
        </p>
      </details>

      <div className="mt-8">
        <h3 className="text-sm font-medium text-neutral-500">Orders &amp; documents</h3>
        <ul className="mt-3 space-y-3">
          {customer.orders.map((order) => (
            <li key={order.id} className="rounded-card border border-border-subtle p-4 text-sm">
              <Link
                href={`/admin/orders/${order.id}`}
                className="flex flex-wrap items-center justify-between gap-3 hover:opacity-80"
              >
                <span className="block text-neutral-500">{formatDate(order.createdAt)}</span>
                <span className="flex flex-col items-end gap-1 text-right text-neutral-500">
                  {order.estimates.length > 0 && <span className="block">{order.estimates.length} estimate(s)</span>}
                  {order.invoice && <StatusPill status={order.invoice.status} />}
                  {order.deliveryNote && <StatusPill status={order.deliveryNote.status} />}
                  {!order.invoice && order.estimates.length === 0 && !order.deliveryNote && "No documents yet"}
                </span>
              </Link>
            </li>
          ))}
          {customer.orders.length === 0 && <p className="text-sm text-neutral-500">No orders yet.</p>}
        </ul>
      </div>

      <div className="mt-8 rounded-card border border-dashed border-accent/50 bg-accent/5 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-medium">AI-derived insight</h3>
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
            Computed / AI-inferred — not verified fact
          </span>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          Lifecycle stage is a plain rule over the order history above. Interests and category signal are Gemini&apos;s
          read of browsing/chat activity — never merged into the customer record itself.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-neutral-500">Lifecycle stage (rule-based)</p>
            <p className="mt-1 font-medium">{LIFECYCLE_LABELS[insights.lifecycle]}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Referrals made</p>
            <p className="mt-1 font-medium">{insights.referralCount}</p>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs text-neutral-500">Inferred interests (from concierge chat &amp; browsing)</p>
          {interestTags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {interestTags.map((tag) => (
                <span key={tag} className="rounded-full border border-border-subtle bg-background px-2.5 py-1 text-xs">
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm text-neutral-400">No signal yet.</p>
          )}
        </div>

        {insights.recentFeedback.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-neutral-500">Recent feedback</p>
            <ul className="mt-2 space-y-1.5">
              {insights.recentFeedback.map((entry) => (
                <li key={entry.id} className="text-sm">
                  {entry.rating ? "★".repeat(entry.rating) + "☆".repeat(5 - entry.rating) : "No rating"}
                  {entry.comment ? ` — "${entry.comment}"` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
