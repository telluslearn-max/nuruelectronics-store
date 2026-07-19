import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin-auth";
import { formatPrice } from "@/lib/format";
import { createInvoice } from "@/lib/admin-actions";
import {
  BillToCard,
  ItemsCard,
  ScreenHeader,
  cardClass,
  cardLabelClass,
  inputClass,
  primaryButtonClass,
} from "../../_shared";

export const metadata: Metadata = {
  title: "Create invoice",
};

export default async function NewInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession();
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { customer: true, items: true, invoice: true },
  });

  if (!order) notFound();
  if (order.invoice) notFound();

  const formatMoney = (amount: string | number) => formatPrice(String(amount), order.currencyCode);
  const itemsSubtotal = order.items.reduce((sum, item) => sum + Number(item.lineTotal), 0);

  return (
    <div>
      <ScreenHeader backHref={`/admin/orders/${order.id}`} title="Create invoice" />
      <form action={createInvoice.bind(null, order.id)} className="space-y-4">
        <div className={cardClass}>
          <p className={cardLabelClass}>Details</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-neutral-500">Due date</label>
              <input type="date" name="dueAt" className={inputClass} />
            </div>
          </div>
        </div>

        <BillToCard customer={order.customer} />
        <ItemsCard items={order.items} currencyCode={order.currencyCode} />

        <div className={cardClass}>
          <p className={cardLabelClass}>Total</p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-500">Subtotal</span>
              <span>{formatMoney(itemsSubtotal.toFixed(2))}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-500">Tax</span>
              <input type="number" step="0.01" name="taxTotal" defaultValue={0} className={`${inputClass} max-w-[9rem]`} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-500">Shipping</span>
              <input type="number" step="0.01" name="shippingTotal" defaultValue={0} className={`${inputClass} max-w-[9rem]`} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-500">Discount</span>
              <input type="number" step="0.01" name="discountTotal" defaultValue={0} className={`${inputClass} max-w-[9rem]`} />
            </div>
          </div>
        </div>

        <div className="rounded-card bg-neutral-100 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Amount due</p>
            <p className="text-lg font-semibold">≥ {formatMoney(itemsSubtotal.toFixed(2))}</p>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Equals subtotal plus any tax/shipping minus discount entered above — no payments recorded yet.
          </p>
        </div>

        <div className={cardClass}>
          <p className={cardLabelClass}>Note</p>
          <textarea name="note" rows={2} className={`${inputClass} mt-2 resize-none`} placeholder="Optional note for the customer" />
        </div>

        <button type="submit" className={`${primaryButtonClass} w-full sm:w-auto`}>
          Create invoice
        </button>
      </form>
    </div>
  );
}
