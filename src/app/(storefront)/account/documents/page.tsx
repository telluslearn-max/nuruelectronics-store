import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusPill } from "@/components/admin/status-pill";
import { DownloadIcon } from "@/components/download-icon";
import { getCurrentCustomer } from "@/lib/customer";
import { isCustomerAuthConfigured } from "@/lib/customer-auth";
import { formatPrice } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "My Documents",
  robots: { index: false, follow: false },
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

export default async function AccountDocumentsPage() {
  if (!isCustomerAuthConfigured) {
    redirect("/account");
  }

  const customer = await getCurrentCustomer();
  if (!customer) {
    redirect("/api/auth/login");
  }
  if (!customer.email) {
    redirect("/account");
  }

  const dbCustomer = await prisma.customer.findUnique({
    where: { email: customer.email.toLowerCase() },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        include: { estimates: true, invoice: { include: { receipts: true } }, deliveryNote: true },
      },
    },
  });

  const orders = dbCustomer?.orders ?? [];

  return (
    <div>
      <h1 className="text-title">My Documents</h1>
      <p className="mt-2 text-neutral-500">Estimates, invoices, receipts, and delivery notes for your orders.</p>

      {orders.length === 0 ? (
        <div className="mt-8">
          <p className="text-neutral-500">No documents yet.</p>
          <Link
            href="/shop"
            className="mt-4 inline-block rounded-control border border-border-subtle px-5 py-2.5 text-sm font-medium transition hover:border-foreground"
          >
            Browse products
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-6">
          {orders.map((order) => (
            <li key={order.id} className="rounded-card border border-border-subtle p-5">
              <p className="font-medium">{order.shopifyOrderName ?? `Order ${order.id.slice(0, 8)}`}</p>
              <p className="text-sm text-neutral-500">{formatDate(order.createdAt)}</p>

              <div className="mt-4 space-y-2 text-sm">
                {order.estimates.map((estimate) => (
                  <div key={estimate.id} className="flex items-center justify-between">
                    <span className="flex flex-wrap items-center gap-1.5">
                      Estimate {estimate.number}
                      <StatusPill status={estimate.status} />
                      {(estimate.status === "draft" || estimate.status === "sent") && (
                        <span className="text-neutral-400">
                          · Valid until {formatDate(estimate.validUntil)}
                        </span>
                      )}
                      {estimate.status === "draft" || estimate.status === "sent" ? (
                        <>
                          ·{" "}
                          <a
                            className="underline hover:text-foreground"
                            href={`/estimates/${estimate.id}?token=${estimate.accessToken}`}
                          >
                            Respond
                          </a>
                        </>
                      ) : null}
                    </span>
                    <a
                      className="flex items-center gap-1 underline hover:text-foreground"
                      href={`/api/estimates/${estimate.id}/pdf`}
                    >
                      <DownloadIcon className="h-4 w-4" />
                      Download PDF
                    </a>
                  </div>
                ))}

                {order.invoice && (
                  <div className="flex items-center justify-between">
                    <span className="flex flex-wrap items-center gap-1.5">
                      Invoice {order.invoice.number}
                      <StatusPill status={order.invoice.status} />·{" "}
                      {formatPrice(order.invoice.total.toString(), order.currencyCode)}
                    </span>
                    <a
                      className="flex items-center gap-1 underline hover:text-foreground"
                      href={`/api/invoices/${order.invoice.id}/pdf`}
                    >
                      <DownloadIcon className="h-4 w-4" />
                      Download PDF
                    </a>
                  </div>
                )}

                {order.invoice?.receipts.map((receipt) => (
                  <div key={receipt.id} className="flex items-center justify-between pl-4">
                    <span>
                      Receipt {receipt.number} · {formatPrice(receipt.amount.toString(), order.currencyCode)}
                    </span>
                    <a
                      className="flex items-center gap-1 underline hover:text-foreground"
                      href={`/api/receipts/${receipt.id}/pdf`}
                    >
                      <DownloadIcon className="h-4 w-4" />
                      Download PDF
                    </a>
                  </div>
                ))}

                {order.deliveryNote && (
                  <div className="flex items-center justify-between">
                    <span className="flex flex-wrap items-center gap-1.5">
                      Delivery note {order.deliveryNote.number}
                      <StatusPill status={order.deliveryNote.status} />
                    </span>
                    <a
                      className="flex items-center gap-1 underline hover:text-foreground"
                      href={`/api/delivery-notes/${order.deliveryNote.id}/pdf`}
                    >
                      <DownloadIcon className="h-4 w-4" />
                      Download PDF
                    </a>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
