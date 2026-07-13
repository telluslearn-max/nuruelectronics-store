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

      <div className="mt-6 overflow-x-auto">
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
