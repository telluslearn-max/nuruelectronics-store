import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin-auth";
import { formatPrice } from "@/lib/format";
import {
  createDeliveryNote,
  createEstimate,
  createInvoice,
  createInvoiceFromEstimate,
  markDelivered,
  recordPayment,
  sendDeliveryNoteEmail,
  sendEstimateEmail,
  sendInvoiceEmail,
  sendReceiptEmail,
  voidInvoice,
} from "@/lib/admin-actions";

export const metadata: Metadata = {
  title: "Order",
};

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

const inputClass =
  "rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground";
const primaryButtonClass =
  "rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90";
const secondaryButtonClass =
  "rounded-control border border-border-subtle px-4 py-2 text-sm font-medium transition hover:border-foreground";

export default async function AdminOrderHubPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession();
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      items: true,
      estimates: { orderBy: { createdAt: "desc" } },
      invoice: { include: { receipts: { orderBy: { paidAt: "desc" } } } },
      deliveryNote: true,
    },
  });

  if (!order) notFound();

  const formatMoney = (amount: string | number) => formatPrice(String(amount), order.currencyCode);
  const acceptedEstimateWithoutInvoice = order.estimates.find((e) => e.status === "accepted") && !order.invoice;

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-lg font-medium">
          {order.shopifyOrderName ?? `Manual order ${order.id.slice(0, 8)}`}
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          {order.customer.name ?? order.customer.email} · {order.customer.email} · {formatDate(order.createdAt)} ·{" "}
          {order.source}
        </p>
        <ul className="mt-4 space-y-1 text-sm">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between">
              <span>
                {item.title} × {item.quantity}
              </span>
              <span>{formatMoney(item.lineTotal.toString())}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Estimates */}
      <section className="rounded-card border border-border-subtle p-5">
        <h3 className="font-medium">Estimates</h3>
        <ul className="mt-3 space-y-3 text-sm">
          {order.estimates.map((estimate) => (
            <li key={estimate.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {estimate.number} · {estimate.status} · {formatMoney(estimate.total.toString())}
              </span>
              <div className="flex gap-2">
                <a className="underline hover:text-foreground" href={`/api/estimates/${estimate.id}/pdf`}>
                  Download PDF
                </a>
                <form action={sendEstimateEmail.bind(null, estimate.id)}>
                  <button type="submit" className="underline hover:text-foreground">
                    Send email
                  </button>
                </form>
                {estimate.status === "accepted" && !order.invoice && (
                  <form action={createInvoiceFromEstimate.bind(null, estimate.id)}>
                    <button type="submit" className="underline hover:text-foreground">
                      Create invoice from this
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
          {order.estimates.length === 0 && <p className="text-neutral-500">No estimates yet.</p>}
        </ul>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium">New estimate</summary>
          <form action={createEstimate.bind(null, order.id)} className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-neutral-500">Valid until</label>
              <input type="date" name="validUntil" required className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-neutral-500">Tax</label>
              <input type="number" step="0.01" name="taxTotal" defaultValue={0} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-neutral-500">Shipping</label>
              <input type="number" step="0.01" name="shippingTotal" defaultValue={0} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-neutral-500">Discount</label>
              <input type="number" step="0.01" name="discountTotal" defaultValue={0} className={inputClass} />
            </div>
            <button type="submit" className={primaryButtonClass}>
              Create estimate
            </button>
          </form>
        </details>
        {acceptedEstimateWithoutInvoice && (
          <p className="mt-2 text-sm text-neutral-500">
            An estimate has been accepted — use &ldquo;Create invoice from this&rdquo; above, or create one manually
            below.
          </p>
        )}
      </section>

      {/* Invoice */}
      <section className="rounded-card border border-border-subtle p-5">
        <h3 className="font-medium">Invoice</h3>
        {order.invoice ? (
          <div className="mt-3 space-y-3 text-sm">
            <p>
              {order.invoice.number} · {order.invoice.status} · Total {formatMoney(order.invoice.total.toString())} ·
              Paid {formatMoney(order.invoice.amountPaid.toString())} · Balance{" "}
              {formatMoney((Number(order.invoice.total) - Number(order.invoice.amountPaid)).toFixed(2))}
            </p>
            <div className="flex flex-wrap gap-3">
              <a className="underline hover:text-foreground" href={`/api/invoices/${order.invoice.id}/pdf`}>
                Download PDF
              </a>
              <form action={sendInvoiceEmail.bind(null, order.invoice.id)}>
                <button type="submit" className="underline hover:text-foreground">
                  Send email
                </button>
              </form>
              {order.invoice.status !== "paid" && order.invoice.status !== "void" && (
                <form action={voidInvoice.bind(null, order.invoice.id)}>
                  <button type="submit" className="underline hover:text-foreground">
                    Void
                  </button>
                </form>
              )}
            </div>

            {order.invoice.status !== "paid" && order.invoice.status !== "void" && (
              <details>
                <summary className="cursor-pointer font-medium">Record payment</summary>
                <form
                  action={recordPayment.bind(null, order.invoice.id)}
                  className="mt-3 flex flex-wrap items-end gap-3"
                >
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
                    <label className="block text-xs text-neutral-500">Reference (M-Pesa code)</label>
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

            {order.invoice.receipts.length > 0 && (
              <div>
                <p className="font-medium">Receipts</p>
                <ul className="mt-2 space-y-2">
                  {order.invoice.receipts.map((receipt) => (
                    <li key={receipt.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {receipt.number} · {formatMoney(receipt.amount.toString())} · {receipt.method} ·{" "}
                        {formatDate(receipt.paidAt)}
                      </span>
                      <div className="flex gap-2">
                        <a className="underline hover:text-foreground" href={`/api/receipts/${receipt.id}/pdf`}>
                          Download PDF
                        </a>
                        <form action={sendReceiptEmail.bind(null, receipt.id)}>
                          <button type="submit" className="underline hover:text-foreground">
                            Send email
                          </button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium">Create invoice</summary>
            <form action={createInvoice.bind(null, order.id)} className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-neutral-500">Tax</label>
                <input type="number" step="0.01" name="taxTotal" defaultValue={0} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-neutral-500">Shipping</label>
                <input type="number" step="0.01" name="shippingTotal" defaultValue={0} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-neutral-500">Discount</label>
                <input type="number" step="0.01" name="discountTotal" defaultValue={0} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-neutral-500">Due date</label>
                <input type="date" name="dueAt" className={inputClass} />
              </div>
              <button type="submit" className={primaryButtonClass}>
                Create invoice
              </button>
            </form>
          </details>
        )}
      </section>

      {/* Delivery note */}
      <section className="rounded-card border border-border-subtle p-5">
        <h3 className="font-medium">Delivery note</h3>
        {order.deliveryNote ? (
          <div className="mt-3 space-y-3 text-sm">
            <p>
              {order.deliveryNote.number} · {order.deliveryNote.status} · {order.deliveryNote.recipientName} ·{" "}
              {order.deliveryNote.deliveryAddress}
            </p>
            <div className="flex flex-wrap gap-3">
              <a className="underline hover:text-foreground" href={`/api/delivery-notes/${order.deliveryNote.id}/pdf`}>
                Download PDF
              </a>
              <form action={sendDeliveryNoteEmail.bind(null, order.deliveryNote.id)}>
                <button type="submit" className="underline hover:text-foreground">
                  Send email
                </button>
              </form>
            </div>
            {order.deliveryNote.status === "pending" && (
              <form
                action={markDelivered.bind(null, order.deliveryNote.id)}
                className="flex flex-wrap items-end gap-3"
              >
                <div>
                  <label className="block text-xs text-neutral-500">Received by</label>
                  <input type="text" name="receivedBy" className={inputClass} />
                </div>
                <button type="submit" className={secondaryButtonClass}>
                  Mark delivered
                </button>
              </form>
            )}
          </div>
        ) : (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium">Create delivery note</summary>
            <form action={createDeliveryNote.bind(null, order.id)} className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-neutral-500">Recipient name</label>
                <input type="text" name="recipientName" required className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-neutral-500">Recipient phone</label>
                <input type="text" name="recipientPhone" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-neutral-500">Delivery address</label>
                <input type="text" name="deliveryAddress" required className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-neutral-500">Method</label>
                <input type="text" name="deliveryMethod" placeholder="Rider, courier, pickup…" className={inputClass} />
              </div>
              <button type="submit" className={primaryButtonClass}>
                Create delivery note
              </button>
            </form>
          </details>
        )}
      </section>
    </div>
  );
}
