import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { parsePage, type PageSearchParams } from "@/lib/pagination";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { importXprizePlRevenue } from "@/lib/admin-actions";
import { FeedbackBanner } from "@/components/admin/feedback-banner";

export const metadata: Metadata = { title: "Receipts" };

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

export default async function AdminReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams & { success?: string; error?: string }>;
}) {
  await requireAdminSession();
  const resolvedSearchParams = await searchParams;
  const { success, error } = resolvedSearchParams;
  const { page, skip, take } = parsePage(resolvedSearchParams);

  const [receipts, totalCount] = await Promise.all([
    prisma.receipt.findMany({
      orderBy: { paidAt: "desc" },
      include: { invoice: { include: { order: { include: { customer: true } } } } },
      skip,
      take,
    }),
    prisma.receipt.count(),
  ]);

  return (
    <div>
      <h2 className="text-lg font-medium">Receipts</h2>
      <FeedbackBanner success={success} error={error} />

      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-medium text-neutral-500">
          Import XPRIZE P&amp;L data — revenue (one-time)
        </summary>
        <form action={importXprizePlRevenue} className="mt-3">
          <p className="text-xs text-neutral-500">
            Loads the 28 &quot;Independent Sales&quot; transactions from the Build with Gemini XPRIZE P&amp;L
            statement (M-Pesa acct 254745864474, 2 Jul – 14 Aug 2026) as customers, orders, invoices, and paid
            receipts. Safe to run more than once — already-recorded transactions (by M-Pesa receipt number) are
            skipped.
          </p>
          <button
            type="submit"
            className="mt-3 rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
          >
            Import
          </button>
        </form>
      </details>

      <ul className="mt-6 space-y-3">
        {receipts.map((receipt) => (
          <li key={receipt.id} className="rounded-card border border-border-subtle p-4 text-sm">
            <Link
              href={`/admin/orders/${receipt.invoice.orderId}`}
              className="flex flex-wrap items-center justify-between gap-3 hover:opacity-80"
            >
              <span>
                <span className="block font-medium">{receipt.number}</span>
                <span className="mt-1 block text-neutral-500">
                  {receipt.method === "mpesa" ? "M-Pesa" : "Cash"} · {formatDate(receipt.paidAt)}
                </span>
              </span>
              <span className="text-right">
                <span className="block font-medium">
                  {receipt.invoice.order.customer.name ?? receipt.invoice.order.customer.email}
                </span>
                <span className="mt-1 block text-lg font-semibold">
                  {formatPrice(receipt.amount.toString(), receipt.invoice.order.currencyCode)}
                </span>
              </span>
            </Link>
          </li>
        ))}
        {receipts.length === 0 && <p className="text-sm text-neutral-500">No receipts yet.</p>}
      </ul>
      <PaginationControls
        pathname="/admin/receipts"
        searchParams={resolvedSearchParams}
        page={page}
        pageSize={take}
        totalCount={totalCount}
      />
    </div>
  );
}
