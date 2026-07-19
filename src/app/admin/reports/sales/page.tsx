import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getShopifyOrders, isShopifyAdminConfigured } from "@/lib/shopify/admin-api";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Sales Register" };

function formatDate(dateString: string | Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(new Date(dateString));
}

export default async function AdminSalesRegisterPage() {
  await requireAdminSession();

  let shopifyError: string | null = null;

  const [manualOrders, shopifyPage] = await Promise.all([
    prisma.order.findMany({
      where: { source: "manual" },
      include: { customer: true, items: true },
      orderBy: { createdAt: "desc" },
    }),
    isShopifyAdminConfigured
      ? getShopifyOrders({ first: 100 }).catch((error: unknown) => {
          shopifyError = error instanceof Error ? error.message : "Unknown error";
          return { orders: [], hasNextPage: false, endCursor: null };
        })
      : Promise.resolve({ orders: [], hasNextPage: false, endCursor: null }),
  ]);

  const rows = [
    ...manualOrders.map((order) => ({
      id: order.id,
      date: order.createdAt,
      customer: order.customer.name ?? order.customer.email,
      source: "Manual",
      total: order.items.reduce((sum, item) => sum + Number(item.lineTotal), 0),
      currency: order.currencyCode,
    })),
    ...shopifyPage.orders.map((order) => ({
      id: order.id,
      date: new Date(order.processedAt),
      customer: order.customer?.displayName ?? "—",
      source: `Shopify ${order.name}`,
      total: Number(order.currentTotalPriceSet.shopMoney.amount),
      currency: order.currentTotalPriceSet.shopMoney.currencyCode,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div>
      <h2 className="text-lg font-medium">Sales Register</h2>
      <p className="mt-2 text-neutral-500">Shopify and manual/WhatsApp orders, merged and in date order.</p>
      {!isShopifyAdminConfigured && (
        <p className="mt-2 text-sm text-neutral-500">
          Set SHOPIFY_ADMIN_API_ACCESS_TOKEN to include live Shopify orders here.
        </p>
      )}
      {shopifyError && <p className="mt-2 text-sm text-red-600">Couldn&apos;t load Shopify orders: {shopifyError}</p>}

      <ul className="mt-6 space-y-3 sm:hidden">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 rounded-card border border-border-subtle p-4 text-sm">
            <span>
              <span className="block font-medium">{row.customer}</span>
              <span className="mt-1 block text-neutral-500">
                {row.source} · {formatDate(row.date)}
              </span>
            </span>
            <span className="text-lg font-semibold">{formatPrice(row.total.toFixed(2), row.currency)}</span>
          </li>
        ))}
        {rows.length === 0 && <p className="text-sm text-neutral-500">No sales recorded yet.</p>}
      </ul>

      <div className="mt-6 hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs text-neutral-500">
              <th className="py-2">Date</th>
              <th className="py-2">Customer</th>
              <th className="py-2">Source</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border-subtle/60">
                <td className="py-2">{formatDate(row.date)}</td>
                <td className="py-2">{row.customer}</td>
                <td className="py-2 text-neutral-500">{row.source}</td>
                <td className="py-2 text-right">{formatPrice(row.total.toFixed(2), row.currency)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-neutral-500">
                  No sales recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
