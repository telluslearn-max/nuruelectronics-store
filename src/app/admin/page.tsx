import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getShopifyOrders, isShopifyAdminConfigured } from "@/lib/shopify/admin-api";
import { formatPrice } from "@/lib/format";
import { importShopifyOrder } from "@/lib/admin-actions";

export const metadata: Metadata = {
  title: "Orders",
};

function formatDate(dateString: string | Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(new Date(dateString));
}

export default async function AdminOrdersPage() {
  await requireAdminSession();

  let shopifyError: string | null = null;

  const [manualOrders, shopifyPage] = await Promise.all([
    prisma.order.findMany({
      where: { source: "manual" },
      orderBy: { createdAt: "desc" },
      include: { customer: true, invoice: true, estimates: true, deliveryNote: true },
    }),
    isShopifyAdminConfigured
      ? getShopifyOrders({ first: 25 }).catch((error: unknown) => {
          shopifyError = error instanceof Error ? error.message : "Unknown error";
          return { orders: [], hasNextPage: false, endCursor: null };
        })
      : Promise.resolve({ orders: [], hasNextPage: false, endCursor: null }),
  ]);

  const importedShopifyOrderIds = new Set(
    (
      await prisma.order.findMany({
        where: { source: "shopify" },
        select: { shopifyOrderId: true, id: true },
      })
    ).map((o) => [o.shopifyOrderId, o.id] as const),
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Orders</h2>
        <Link href="/admin/orders/new" className="rounded-control border border-border-subtle px-4 py-2 text-sm font-medium hover:border-foreground">
          + New manual order
        </Link>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-medium text-neutral-500">Manual / WhatsApp orders</h3>
        <ul className="mt-3 space-y-3">
          {manualOrders.map((order) => (
            <li key={order.id} className="rounded-card border border-border-subtle p-4 text-sm">
              <Link href={`/admin/orders/${order.id}`} className="flex flex-wrap items-center justify-between gap-3 hover:opacity-80">
                <span>
                  <span className="block font-medium">{order.customer.name ?? order.customer.email}</span>
                  <span className="mt-1 block text-neutral-500">{formatDate(order.createdAt)}</span>
                </span>
                <span className="text-right text-neutral-500">
                  {order.estimates.length > 0 && <span className="block">{order.estimates.length} estimate(s)</span>}
                  {order.invoice && <span className="block">Invoice {order.invoice.status}</span>}
                  {order.deliveryNote && <span className="block">Delivery {order.deliveryNote.status}</span>}
                  {!order.invoice && order.estimates.length === 0 && !order.deliveryNote && "No documents yet"}
                </span>
              </Link>
            </li>
          ))}
          {manualOrders.length === 0 && <p className="text-sm text-neutral-500">No manual orders yet.</p>}
        </ul>
      </div>

      <div className="mt-10">
        <h3 className="text-sm font-medium text-neutral-500">Shopify orders</h3>
        {!isShopifyAdminConfigured ? (
          <p className="mt-3 text-sm text-neutral-500">
            Set SHOPIFY_ADMIN_API_ACCESS_TOKEN to pull live Shopify orders here.
          </p>
        ) : shopifyError ? (
          <p className="mt-3 text-sm text-red-600">Couldn&apos;t load Shopify orders: {shopifyError}</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {shopifyPage.orders.map((shopifyOrder) => {
              const importedId = [...importedShopifyOrderIds].find(([sid]) => sid === shopifyOrder.id)?.[1];
              return (
                <li key={shopifyOrder.id} className="rounded-card border border-border-subtle p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span>
                      <span className="block font-medium">{shopifyOrder.name}</span>
                      <span className="mt-1 block text-neutral-500">
                        {shopifyOrder.customer?.displayName ?? "No customer"} · {formatDate(shopifyOrder.processedAt)} ·{" "}
                        {shopifyOrder.displayFinancialStatus}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-lg font-semibold">
                        {formatPrice(
                          shopifyOrder.currentTotalPriceSet.shopMoney.amount,
                          shopifyOrder.currentTotalPriceSet.shopMoney.currencyCode,
                        )}
                      </span>
                      {importedId ? (
                        <Link href={`/admin/orders/${importedId}`} className="mt-1 block underline hover:text-foreground">
                          View documents
                        </Link>
                      ) : (
                        <form action={importShopifyOrder.bind(null, shopifyOrder.id)}>
                          <button type="submit" className="mt-1 underline hover:text-foreground">
                            Create documents
                          </button>
                        </form>
                      )}
                    </span>
                  </div>
                </li>
              );
            })}
            {shopifyPage.orders.length === 0 && <p className="text-sm text-neutral-500">No Shopify orders found.</p>}
          </ul>
        )}
      </div>
    </div>
  );
}
