import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Receipts" };

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

export default async function AdminReceiptsPage() {
  await requireAdminSession();

  const receipts = await prisma.receipt.findMany({
    orderBy: { paidAt: "desc" },
    include: { invoice: { include: { order: { include: { customer: true } } } } },
  });

  return (
    <div>
      <h2 className="text-lg font-medium">Receipts</h2>
      <ul className="mt-6 space-y-3">
        {receipts.map((receipt) => (
          <li key={receipt.id} className="rounded-card border border-border-subtle p-4 text-sm">
            <Link
              href={`/admin/orders/${receipt.invoice.orderId}`}
              className="flex flex-wrap items-center justify-between gap-2 hover:underline"
            >
              <span>
                {receipt.number} ·{" "}
                {receipt.invoice.order.customer.name ?? receipt.invoice.order.customer.email} ·{" "}
                {formatDate(receipt.paidAt)}
              </span>
              <span className="text-neutral-500">
                {receipt.method} · {formatPrice(receipt.amount.toString(), receipt.invoice.order.currencyCode)}
              </span>
            </Link>
          </li>
        ))}
        {receipts.length === 0 && <p className="text-sm text-neutral-500">No receipts yet.</p>}
      </ul>
    </div>
  );
}
