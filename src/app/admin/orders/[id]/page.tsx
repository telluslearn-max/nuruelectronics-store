import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin-auth";
import { formatPrice } from "@/lib/format";
import { displayEmail } from "@/lib/customer-email";
import { StatusPill } from "@/components/admin/status-pill";
import { getShopifyOrderById } from "@/lib/shopify/admin-api";
import { ConfirmPendingSubmitButton } from "@/components/admin/confirm-submit-button";
import { FeedbackBanner } from "@/components/admin/feedback-banner";
import { SubmitButton } from "@/components/admin/submit-button";
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
  PlusIcon,
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

  // For Shopify-sourced orders, the internal Invoice's "paid" status is bookkeeping staff enter
  // by hand and can drift from reality — the live Shopify order is the actual source of truth for
  // whether real money has been received (e.g. a Cash on Delivery order stays financially Pending
  // in Shopify until cash is collected on delivery, regardless of what's recorded here).
  const liveShopifyOrder =
    order.source === "shopify" && order.shopifyOrderId ? await getShopifyOrderById(order.shopifyOrderId) : null;
  const paymentConfirmed =
    order.source === "shopify" ? liveShopifyOrder?.displayFinancialStatus === "PAID" : order.invoice?.status === "paid";

  const formatMoney = (amount: string | number) => formatPrice(String(amount), order.currencyCode);
  const acceptedEstimateWithoutInvoice = order.estimates.find((e) => e.status === "accepted") && !order.invoice;
  const itemsSubtotal = order.items.reduce((sum, item) => sum + Number(item.lineTotal), 0);
  const invoiceDeletable = order.invoice ? Number(order.invoice.amountPaid) === 0 : false;
  const invoiceEditable =
    order.invoice != null &&
    Number(order.invoice.amountPaid) === 0 &&
    (order.invoice.status === "draft" || order.invoice.status === "sent");
  // Shared by the Void button and the Record payment section below — both were repeating the
  // same "not already settled" check inline.
  const invoiceOpen = order.invoice != null && order.invoice.status !== "paid" && order.invoice.status !== "void";
  const invoiceVoidable = invoiceOpen && Number(order.invoice?.amountPaid) === 0;

  return (
    <div className="space-y-10">
      <FeedbackBanner success={success} error={error} />
      <div>
        <h2 className="text-lg font-medium">
          {order.shopifyOrderName ?? `Manual order ${order.id.slice(0, 8)}`}
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          {[
            order.customer.name ?? displayEmail(order.customer.email) ?? order.customer.phone ?? "Customer",
            // Only show email as a second segment if the name already took the primary slot —
            // otherwise it would just repeat whatever the primary slot fell back to.
            order.customer.name ? displayEmail(order.customer.email) : null,
            formatDate(order.createdAt),
            order.source,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {liveShopifyOrder && (
          <div
            className={`mt-3 rounded-control border px-3 py-2 text-sm ${
              paymentConfirmed
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Shopify payment:</span>
              <StatusPill status={liveShopifyOrder.displayFinancialStatus} />
              {liveShopifyOrder.paymentGatewayNames.length > 0 && (
                <span>via {liveShopifyOrder.paymentGatewayNames.join(", ")}</span>
              )}
            </span>
            {!paymentConfirmed && (
              <p className="mt-1">
                Shopify hasn&apos;t recorded real payment for this order yet — don&apos;t treat it as sold or
                hand over/ship the product until this is confirmed paid (or cash is collected, for COD).
              </p>
            )}
          </div>
        )}
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
                      <SubmitButton className="underline hover:text-foreground" pendingText="Sending…">
                        Send email
                      </SubmitButton>
                    </form>
                    {estimate.status === "accepted" && !order.invoice && (
                      <form action={createInvoiceFromEstimate.bind(null, estimate.id)}>
                        <SubmitButton className="underline hover:text-foreground" pendingText="Creating…">
                          Create invoice from this
                        </SubmitButton>
                      </form>
                    )}
                    {editable && <span className="text-neutral-300">·</span>}
                    {editable && (
                      <form action={deleteEstimate.bind(null, estimate.id)}>
                        <ConfirmPendingSubmitButton
                          confirmMessage={`Delete estimate ${estimate.number}? This removes the document completely — this can't be undone.`}
                          className="underline hover:text-foreground"
                        >
                          Delete
                        </ConfirmPendingSubmitButton>
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

                      <SubmitButton className={primaryButtonClass}>Save changes</SubmitButton>
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
          className={`mt-5 inline-flex items-center gap-1.5 ${secondaryButtonClass}`}
        >
          <PlusIcon className="h-4 w-4" />
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
                <SubmitButton className="underline hover:text-foreground" pendingText="Sending…">
                  Send email
                </SubmitButton>
              </form>
              {invoiceVoidable && (
                <form action={voidInvoice.bind(null, order.invoice.id)}>
                  <SubmitButton className="underline hover:text-foreground" pendingText="Voiding…">
                    Void
                  </SubmitButton>
                </form>
              )}
              {invoiceDeletable && (
                <form action={deleteInvoice.bind(null, order.invoice.id)}>
                  <ConfirmPendingSubmitButton
                    confirmMessage={`Delete invoice ${order.invoice.number}? This removes it and its ledger entries completely — this can't be undone.`}
                    className="underline hover:text-foreground"
                  >
                    Delete
                  </ConfirmPendingSubmitButton>
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

                  <SubmitButton className={primaryButtonClass}>Save changes</SubmitButton>
                </form>
              </details>
            )}

            {invoiceOpen && (
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
                    <SubmitButton className={`${primaryButtonClass} w-full sm:w-auto`} pendingText="Recording…">
                      Record payment
                    </SubmitButton>
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
                          <SubmitButton className="underline hover:text-foreground" pendingText="Sending…">
                            Send email
                          </SubmitButton>
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
            className={`mt-3 inline-flex items-center gap-1.5 ${secondaryButtonClass}`}
          >
            <PlusIcon className="h-4 w-4" />
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
                <SubmitButton className="underline hover:text-foreground" pendingText="Sending…">
                  Send email
                </SubmitButton>
              </form>
              {order.deliveryNote.status === "pending" && (
                <form action={deleteDeliveryNote.bind(null, order.deliveryNote.id)}>
                  <ConfirmPendingSubmitButton
                    confirmMessage={`Delete delivery note ${order.deliveryNote.number}? This removes the document completely — this can't be undone.`}
                    className="underline hover:text-foreground"
                  >
                    Delete
                  </ConfirmPendingSubmitButton>
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
                  <SubmitButton className={primaryButtonClass}>Save changes</SubmitButton>
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
                {!paymentConfirmed && (
                  <label className="flex items-center gap-2 text-sm text-amber-800 sm:basis-full">
                    <input type="checkbox" name="confirmPayment" required className="h-4 w-4" />
                    I confirm payment has actually been received for this order
                  </label>
                )}
                <SubmitButton className={`${secondaryButtonClass} w-full sm:w-auto`} pendingText="Marking…">
                  Mark delivered
                </SubmitButton>
              </form>
            )}
          </div>
        ) : (
          <Link
            href={`/admin/orders/${order.id}/delivery-note/new`}
            className={`mt-3 inline-flex items-center gap-1.5 ${secondaryButtonClass}`}
          >
            <PlusIcon className="h-4 w-4" />
            Create delivery note
          </Link>
        )}
      </section>
    </div>
  );
}
