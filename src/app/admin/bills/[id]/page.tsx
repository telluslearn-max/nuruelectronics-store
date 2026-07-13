import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { recordSupplierPayment } from "@/lib/creditor-actions";

export const metadata: Metadata = { title: "Bill" };

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

const inputClass =
  "rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground";
const primaryButtonClass =
  "rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90";

export default async function AdminBillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession();
  const { id } = await params;

  const bill = await prisma.bill.findUnique({
    where: { id },
    include: { supplier: true, payments: { orderBy: { paidAt: "desc" } } },
  });
  if (!bill) notFound();

  const balance = Number(bill.amount) - Number(bill.amountPaid);

  return (
    <div>
      <h2 className="text-lg font-medium">{bill.number}</h2>
      <p className="mt-1 text-sm text-neutral-500">
        {bill.supplier.name} · {bill.description} · Bill date {formatDate(bill.billDate)} · Due {formatDate(bill.dueAt)}
      </p>
      <p className="mt-3 text-sm">
        {bill.status} · Total {formatPrice(bill.amount.toString(), "KES")} · Paid{" "}
        {formatPrice(bill.amountPaid.toString(), "KES")} · Balance {formatPrice(balance.toFixed(2), "KES")}
      </p>

      {bill.status !== "paid" && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-medium">Record payment</summary>
          <form action={recordSupplierPayment.bind(null, bill.id)} className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-neutral-500">Amount</label>
              <input type="number" step="0.01" name="amount" required className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-neutral-500">Method</label>
              <select name="method" required className={inputClass}>
                <option value="cash">Cash</option>
                <option value="mpesa">M-Pesa</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-500">Reference</label>
              <input type="text" name="reference" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-neutral-500">Paid on</label>
              <input type="date" name="paidAt" className={inputClass} />
            </div>
            <button type="submit" className={primaryButtonClass}>
              Record payment
            </button>
          </form>
        </details>
      )}

      {bill.payments.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-medium">Payments</p>
          <ul className="mt-2 space-y-2 text-sm">
            {bill.payments.map((payment) => (
              <li key={payment.id} className="flex justify-between rounded-card border border-border-subtle p-3">
                <span>
                  {formatDate(payment.paidAt)} · {payment.method}
                  {payment.reference ? ` · ${payment.reference}` : ""}
                </span>
                <span>{formatPrice(payment.amount.toString(), "KES")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
