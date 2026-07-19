import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Debtors Ledger" };

export default async function AdminDebtorsReportPage() {
  await requireAdminSession();

  // The ledger recognizes the receivable as soon as an invoice is created (see
  // createInvoice/createInvoiceFromEstimate), not only once it's been emailed —
  // so every non-void, non-fully-paid invoice is a real outstanding debt here.
  const invoices = await prisma.invoice.findMany({
    where: { status: { notIn: ["paid", "void"] } },
    include: { order: { include: { customer: true } } },
    orderBy: { createdAt: "asc" },
  });

  const outstanding = invoices
    .map((invoice) => ({ ...invoice, balance: Number(invoice.total) - Number(invoice.amountPaid) }))
    .filter((invoice) => invoice.balance > 0);
  const total = outstanding.reduce((sum, invoice) => sum + invoice.balance, 0);

  return (
    <div>
      <h2 className="text-lg font-medium">Debtors Ledger</h2>
      <p className="mt-2 text-neutral-500">Customers with an outstanding invoice balance, oldest first.</p>

      <ul className="mt-6 space-y-3 sm:hidden">
        {outstanding.map((invoice) => (
          <li key={invoice.id} className="rounded-card border border-border-subtle p-4 text-sm">
            <Link href={`/admin/orders/${invoice.orderId}`} className="flex items-center justify-between gap-3 hover:opacity-80">
              <span>
                <span className="block font-medium">{invoice.order.customer.name ?? invoice.order.customer.email}</span>
                <span className="mt-1 block text-neutral-500">{invoice.number}</span>
              </span>
              <span className="text-lg font-semibold">
                {formatPrice(invoice.balance.toFixed(2), invoice.order.currencyCode)}
              </span>
            </Link>
          </li>
        ))}
        {outstanding.length === 0 && <p className="text-sm text-neutral-500">No outstanding invoices.</p>}
        {outstanding.length > 0 && (
          <li className="flex justify-between rounded-card border border-foreground p-4 text-sm font-medium">
            <span>Total outstanding</span>
            <span>{formatPrice(total.toFixed(2), "KES")}</span>
          </li>
        )}
      </ul>

      <div className="mt-6 hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs text-neutral-500">
              <th className="py-2">Customer</th>
              <th className="py-2">Invoice</th>
              <th className="py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {outstanding.map((invoice) => (
              <tr key={invoice.id} className="border-b border-border-subtle/60">
                <td className="py-2">{invoice.order.customer.name ?? invoice.order.customer.email}</td>
                <td className="py-2">
                  <Link href={`/admin/orders/${invoice.orderId}`} className="underline hover:text-foreground">
                    {invoice.number}
                  </Link>
                </td>
                <td className="py-2 text-right">{formatPrice(invoice.balance.toFixed(2), invoice.order.currencyCode)}</td>
              </tr>
            ))}
            {outstanding.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-neutral-500">
                  No outstanding invoices.
                </td>
              </tr>
            )}
          </tbody>
          {outstanding.length > 0 && (
            <tfoot>
              <tr className="font-medium">
                <td className="py-2" colSpan={2}>
                  Total outstanding
                </td>
                <td className="py-2 text-right">{formatPrice(total.toFixed(2), "KES")}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
