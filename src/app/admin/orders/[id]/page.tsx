import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin-auth";
import { formatPrice } from "@/lib/format";
import { StatusPill } from "@/components/admin/status-pill";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { FeedbackBanner } from "@/components/admin/feedback-banner";
import {
  createInvoiceFromEstimate,
  deleteDeliveryNote,
  deleteEstimate,
  deleteInvoice,
  markDelivered,
  recordPayment,
  sendDeliveryNoteEmail,
  sendEstimateEmail,
  sendInvoiceEmail,
  sendReceiptEmail,
  updateDeliveryNote,
  updateEstimate,
  updateInvoice,
  voidInvoice,
} from "@/lib/admin-actions";
import {
  BillToCard,
  ItemsCard,
  cardClass,
  cardLabelClass,
  formatDate,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  toDateInputValue,
} from "./_shared";

export const metadata: Metadata = {
  title: "Order",
};

export default async function AdminOrderHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  await requireAdminSession();
  const { id } = await params;
  const { success, error } = await searchParams;

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

  const riders =
    order.deliveryNote?.status === "pending"
      ? await prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } })
      : [];

  const formatMoney = (amount: string | number) => formatPrice(String(amount), order.currencyCode);
  const acceptedEstimateWithoutInvoice = order.estimates.find((e) => e.status === "accepted") && !order.invoice;
  const itemsSubtotal = order.items.reduce((sum, item) => sum + Number(item.lineTotal), 0);
  const invoiceDeletable = order.invoice ? Number(order.invoice.amountPaid) === 0 : false;
  const invoiceEditable =
    order.invoice != null &&
    Number(order.invoice.amountPaid) === 0 &&
    (order.invoice.status === "draft" || order.invoice.status === "sent");

  return (
    <div className="space-y-10">
      <FeedbackBanner success={success} error={error} />
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
          {order.estimates.map((estimate) => {
            const editable = estimate.status === "draft" || estimate.status === "sent";
            return (
              <li key={estimate.id} className="border-b border-border-subtle/60 pb-3 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    <span className="block font-medium">{estimate.number}</span>
                    <span className="mt-1 flex items-center gap-2">
                      <StatusPill status={estimate.status} />
                      <span className="text-lg font-semibold">{formatMoney(estimate.total.toString())}</span>
                    </span>
                  </span>
                  <div className="flex flex-wrap gap-3 text-sm">
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
                    {editable && <span className="text-neutral-300">·</span>}
                    {editable && (
                      <form action={deleteEstimate.bind(null, estimate.id)}>
                        <ConfirmSubmitButton
                          confirmMessage={`Delete estimate ${estimate.number}? This can't be undone.`}
                          className="underline hover:text-foreground"
                        >
                          Delete
                        </ConfirmSubmitButton>
                      </form>
                    )}
                  </div>
                </div>
                {editable && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium">Edit estimate</summary>
                    <form action={updateEstimate.bind(null, estimate.id)} className="mt-4 space-y-4">
                      <div className={cardClass}>
                        <p className={cardLabelClass}>Details</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="block text-xs text-neutral-500">Valid until</label>
                            <input
                              type="date"
                              name="validUntil"
                              required
                              defaultValue={toDateInputValue(estimate.validUntil)}
                              className={inputClass}
                            />
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
                            <input
                              type="number"
                              step="0.01"
                              name="taxTotal"
                              defaultValue={estimate.taxTotal.toString()}
                              className={`${inputClass} max-w-[9rem]`}
                            />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-neutral-500">Shipping</span>
                            <input
                              type="number"
                              step="0.01"
                              name="shippingTotal"
                              defaultValue={estimate.shippingTotal.toString()}
                              className={`${inputClass} max-w-[9rem]`}
                            />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-neutral-500">Discount</span>
                            <input
                              type="number"
                              step="0.01"
                              name="discountTotal"
                              defaultValue={estimate.discountTotal.toString()}
                              className={`${inputClass} max-w-[9rem]`}
                            />
                          </div>
                        </div>
                      </div>

                      <div className={cardClass}>
                        <p className={cardLabelClass}>Note</p>
                        <textarea
                          name="note"
                          rows={2}
                          defaultValue={estimate.note ?? ""}
                          className={`${inputClass} mt-2 resize-none`}
                          placeholder="Optional note for the customer"
                        />
                      </div>

                      <button type="submit" className={primaryButtonClass}>
                        Save changes
                      </button>
                    </form>
                  </details>
                )}
              </li>
            );
          })}
          {order.estimates.length === 0 && <p className="text-neutral-500">No estimates yet.</p>}
        </ul>

        <Link
          href={`/admin/orders/${order.id}/estimates/new`}
          className={`mt-5 inline-block ${secondaryButtonClass}`}
        >
          New estimate
        </Link>
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
          <div className="mt-3 space-y-4 text-sm">
            <div>
              <span className="block font-medium">{order.invoice.number}</span>
              <span className="mt-1 flex flex-wrap items-center gap-2">
                <StatusPill status={order.invoice.status} />
                <span className="text-lg font-semibold">{formatMoney(order.invoice.total.toString())}</span>
              </span>
              <p className="mt-1 text-neutral-500">
                Paid {formatMoney(order.invoice.amountPaid.toString())} · Balance{" "}
                {formatMoney((Number(order.invoice.total) - Number(order.invoice.amountPaid)).toFixed(2))}
              </p>
              {order.invoice.note && <p className="mt-2 text-neutral-500">Note: {order.invoice.note}</p>}
            </div>
            <div className="flex flex-wrap gap-3">
              <a className="underline hover:text-foreground" href={`/api/invoices/${order.invoice.id}/pdf`}>
                Download PDF
              </a>
              <form action={sendInvoiceEmail.bind(null, order.invoice.id)}>
                <button type="submit" className="underline hover:text-foreground">
                  Send email
                </button>
              </form>
              {order.invoice.status !== "paid" && order.invoice.status !== "void" && Number(order.invoice.amountPaid) === 0 && (
                <form action={voidInvoice.bind(null, order.invoice.id)}>
                  <button type="submit" className="underline hover:text-foreground">
                    Void
                  </button>
                </form>
              )}
              {invoiceDeletable && (
                <form action={deleteInvoice.bind(null, order.invoice.id)}>
                  <ConfirmSubmitButton
                    confirmMessage={`Delete invoice ${order.invoice.number}? This removes it and its ledger entries completely — this can't be undone.`}
                    className="underline hover:text-foreground"
                  >
                    Delete
                  </ConfirmSubmitButton>
                </form>
              )}
            </div>

            {invoiceEditable && (
              <details>
                <summary className="cursor-pointer font-medium">Edit invoice</summary>
                <form action={updateInvoice.bind(null, order.invoice.id)} className="mt-4 space-y-4">
                  <div className={cardClass}>
                    <p className={cardLabelClass}>Details</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs text-neutral-500">Due date</label>
                        <input
                          type="date"
                          name="dueAt"
                          defaultValue={toDateInputValue(order.invoice.dueAt)}
                          className={inputClass}
                        />
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
                        <input
                          type="number"
                          step="0.01"
                          name="taxTotal"
                          defaultValue={order.invoice.taxTotal.toString()}
                          className={`${inputClass} max-w-[9rem]`}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-neutral-500">Shipping</span>
                        <input
                          type="number"
                          step="0.01"
                          name="shippingTotal"
                          defaultValue={order.invoice.shippingTotal.toString()}
                          className={`${inputClass} max-w-[9rem]`}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-neutral-500">Discount</span>
                        <input
                          type="number"
                          step="0.01"
                          name="discountTotal"
                          defaultValue={order.invoice.discountTotal.toString()}
                          className={`${inputClass} max-w-[9rem]`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className={cardClass}>
                    <p className={cardLabelClass}>Note</p>
                    <textarea
                      name="note"
                      rows={2}
                      defaultValue={order.invoice.note ?? ""}
                      className={`${inputClass} mt-2 resize-none`}
                      placeholder="Optional note for the customer"
                    />
                  </div>

                  <button type="submit" className={primaryButtonClass}>
                    Save changes
                  </button>
                </form>
              </details>
            )}

            {order.invoice.status !== "paid" && order.invoice.status !== "void" && (
              <details>
                <summary className="cursor-pointer font-medium">Record payment</summary>
                <form
                  action={recordPayment.bind(null, order.invoice.id)}
                  className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"
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
                  <div className="sm:col-span-2">
                    <button type="submit" className={`${primaryButtonClass} w-full sm:w-auto`}>
                      Record payment
                    </button>
                  </div>
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
          <Link
            href={`/admin/orders/${order.id}/invoice/new`}
            className={`mt-3 inline-block ${secondaryButtonClass}`}
          >
            Create invoice
          </Link>
        )}
      </section>

      {/* Delivery note */}
      <section className="rounded-card border border-border-subtle p-5">
        <h3 className="font-medium">Delivery note</h3>
        {order.deliveryNote ? (
          <div className="mt-3 space-y-3 text-sm">
            <div>
              <span className="block font-medium">{order.deliveryNote.number}</span>
              <span className="mt-1 flex items-center gap-2">
                <StatusPill status={order.deliveryNote.status} />
                <span className="text-neutral-500">
                  {order.deliveryNote.recipientName} · {order.deliveryNote.deliveryAddress}
                </span>
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              <a className="underline hover:text-foreground" href={`/api/delivery-notes/${order.deliveryNote.id}/pdf`}>
                Download PDF
              </a>
              <form action={sendDeliveryNoteEmail.bind(null, order.deliveryNote.id)}>
                <button type="submit" className="underline hover:text-foreground">
                  Send email
                </button>
              </form>
              {order.deliveryNote.status === "pending" && (
                <form action={deleteDeliveryNote.bind(null, order.deliveryNote.id)}>
                  <ConfirmSubmitButton
                    confirmMessage={`Delete delivery note ${order.deliveryNote.number}? This can't be undone.`}
                    className="underline hover:text-foreground"
                  >
                    Delete
                  </ConfirmSubmitButton>
                </form>
              )}
            </div>
            {order.deliveryNote.status === "pending" && (
              <details>
                <summary className="cursor-pointer font-medium">Edit delivery note</summary>
                <form action={updateDeliveryNote.bind(null, order.deliveryNote.id)} className="mt-4 space-y-4">
                  <div className={cardClass}>
                    <p className={cardLabelClass}>Recipient</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs text-neutral-500">Recipient name</label>
                        <input
                          type="text"
                          name="recipientName"
                          required
                          defaultValue={order.deliveryNote.recipientName}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-500">Recipient phone</label>
                        <input
                          type="text"
                          name="recipientPhone"
                          defaultValue={order.deliveryNote.recipientPhone ?? ""}
                          className={inputClass}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-neutral-500">Delivery address</label>
                        <input
                          type="text"
                          name="deliveryAddress"
                          required
                          defaultValue={order.deliveryNote.deliveryAddress}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-500">Method</label>
                        <input
                          type="text"
                          name="deliveryMethod"
                          defaultValue={order.deliveryNote.deliveryMethod ?? ""}
                          placeholder="Rider, courier, pickup…"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>
                  <button type="submit" className={primaryButtonClass}>
                    Save changes
                  </button>
                </form>
              </details>
            )}
            {order.deliveryNote.status === "pending" && (
              <form
                action={markDelivered.bind(null, order.deliveryNote.id)}
                className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end"
              >
                <div className="sm:w-56">
                  <label className="block text-xs text-neutral-500">Received by</label>
                  <input type="text" name="receivedBy" className={inputClass} />
                </div>
                <div className="sm:w-56">
                  <label className="block text-xs text-neutral-500">Rider</label>
                  <select name="riderId" className={inputClass} defaultValue="">
                    <option value="">— Not tracked —</option>
                    {riders.map((rider) => (
                      <option key={rider.id} value={rider.id}>
                        {rider.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="submit" className={`${secondaryButtonClass} w-full sm:w-auto`}>
                  Mark delivered
                </button>
              </form>
            )}
          </div>
        ) : (
          <Link
            href={`/admin/orders/${order.id}/delivery-note/new`}
            className={`mt-3 inline-block ${secondaryButtonClass}`}
          >
            Create delivery note
          </Link>
        )}
      </section>
    </div>
  );
}
