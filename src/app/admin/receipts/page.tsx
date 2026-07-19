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
    </div>
  );
}
