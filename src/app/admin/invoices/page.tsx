import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Invoices" };

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

export default async function AdminInvoicesPage() {
  await requireAdminSession();

  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: "desc" },
    include: { order: { include: { customer: true } } },
  });

  return (
    <div>
      <h2 className="text-lg font-medium">Invoices</h2>
      <ul className="mt-6 space-y-3">
        {invoices.map((invoice) => (
          <li key={invoice.id} className="rounded-card border border-border-subtle p-4 text-sm">
            <Link href={`/admin/orders/${invoice.orderId}`} className="flex flex-wrap items-center justify-between gap-2 hover:underline">
              <span>
                {invoice.number} · {invoice.order.customer.name ?? invoice.order.customer.email} ·{" "}
                {formatDate(invoice.createdAt)}
              </span>
              <span className="text-neutral-500">
                {invoice.status} · {formatPrice(invoice.total.toString(), invoice.order.currencyCode)} paid{" "}
                {formatPrice(invoice.amountPaid.toString(), invoice.order.currencyCode)}
              </span>
            </Link>
          </li>
        ))}
        {invoices.length === 0 && <p className="text-sm text-neutral-500">No invoices yet.</p>}
      </ul>
    </div>
  );
}
