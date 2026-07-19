import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Creditors Ledger" };

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

export default async function AdminCreditorsReportPage() {
  await requireAdminSession();

  const bills = await prisma.bill.findMany({
    where: { status: { not: "paid" } },
    include: { supplier: true },
    orderBy: [{ dueAt: "asc" }, { billDate: "asc" }],
  });

  const outstanding = bills.map((bill) => ({
    ...bill,
    balance: Number(bill.amount) - Number(bill.amountPaid),
  }));
  const total = outstanding.reduce((sum, bill) => sum + bill.balance, 0);

  return (
    <div>
      <h2 className="text-lg font-medium">Creditors Ledger</h2>
      <p className="mt-2 text-neutral-500">Outstanding payables by supplier, oldest due date first.</p>

      <ul className="mt-6 space-y-3 sm:hidden">
        {outstanding.map((bill) => (
          <li key={bill.id} className="rounded-card border border-border-subtle p-4 text-sm">
            <Link href={`/admin/bills/${bill.id}`} className="flex items-center justify-between gap-3 hover:opacity-80">
              <span>
                <span className="block font-medium">{bill.supplier.name}</span>
                <span className="mt-1 block text-neutral-500">
                  {bill.number} · Due {formatDate(bill.dueAt)}
                </span>
              </span>
              <span className="text-lg font-semibold">{formatPrice(bill.balance.toFixed(2), "KES")}</span>
            </Link>
          </li>
        ))}
        {outstanding.length === 0 && <p className="text-sm text-neutral-500">No outstanding bills.</p>}
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
              <th className="py-2">Supplier</th>
              <th className="py-2">Bill</th>
              <th className="py-2">Due</th>
              <th className="py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {outstanding.map((bill) => (
              <tr key={bill.id} className="border-b border-border-subtle/60">
                <td className="py-2">{bill.supplier.name}</td>
                <td className="py-2">
                  <Link href={`/admin/bills/${bill.id}`} className="underline hover:text-foreground">
                    {bill.number}
                  </Link>
                </td>
                <td className="py-2">{formatDate(bill.dueAt)}</td>
                <td className="py-2 text-right">{formatPrice(bill.balance.toFixed(2), "KES")}</td>
              </tr>
            ))}
            {outstanding.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-neutral-500">
                  No outstanding bills.
                </td>
              </tr>
            )}
          </tbody>
          {outstanding.length > 0 && (
            <tfoot>
              <tr className="font-medium">
                <td className="py-2" colSpan={3}>
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
