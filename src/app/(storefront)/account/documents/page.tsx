import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentCustomer } from "@/lib/customer";
import { isCustomerAuthConfigured } from "@/lib/customer-auth";
import { formatPrice } from "@/lib/format";

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
        <p className="mt-8 text-neutral-500">No documents yet.</p>
      ) : (
        <ul className="mt-8 space-y-6">
          {orders.map((order) => (
            <li key={order.id} className="rounded-card border border-border-subtle p-5">
              <p className="font-medium">{order.shopifyOrderName ?? `Order ${order.id.slice(0, 8)}`}</p>
              <p className="text-sm text-neutral-500">{formatDate(order.createdAt)}</p>

              <div className="mt-4 space-y-2 text-sm">
                {order.estimates.map((estimate) => (
                  <div key={estimate.id} className="flex items-center justify-between">
                    <span>
                      Estimate {estimate.number} · {estimate.status}
                      {estimate.status === "draft" || estimate.status === "sent" ? (
                        <>
                          {" "}
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
                    <a className="underline hover:text-foreground" href={`/api/estimates/${estimate.id}/pdf`}>
                      Download PDF
                    </a>
                  </div>
                ))}

                {order.invoice && (
                  <div className="flex items-center justify-between">
                    <span>
                      Invoice {order.invoice.number} · {order.invoice.status} ·{" "}
                      {formatPrice(order.invoice.total.toString(), order.currencyCode)}
                    </span>
                    <a className="underline hover:text-foreground" href={`/api/invoices/${order.invoice.id}/pdf`}>
                      Download PDF
                    </a>
                  </div>
                )}

                {order.invoice?.receipts.map((receipt) => (
                  <div key={receipt.id} className="flex items-center justify-between pl-4">
                    <span>
                      Receipt {receipt.number} · {formatPrice(receipt.amount.toString(), order.currencyCode)}
                    </span>
                    <a className="underline hover:text-foreground" href={`/api/receipts/${receipt.id}/pdf`}>
                      Download PDF
                    </a>
                  </div>
                ))}

                {order.deliveryNote && (
                  <div className="flex items-center justify-between">
                    <span>
                      Delivery note {order.deliveryNote.number} · {order.deliveryNote.status}
                    </span>
                    <a
                      className="underline hover:text-foreground"
                      href={`/api/delivery-notes/${order.deliveryNote.id}/pdf`}
                    >
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
