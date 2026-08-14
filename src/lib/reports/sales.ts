import "server-only";
import { prisma } from "../prisma";
import { getShopifyOrders, isShopifyAdminConfigured } from "../shopify/admin-api";
import { rowsToCsv } from "./csv";

export type SalesRow = {
  id: string;
  date: Date;
  customer: string;
  source: string;
  total: number;
  currency: string;
};

export type SalesReport = { rows: SalesRow[]; shopifyError: string | null };

/** Shopify and manual/WhatsApp orders, merged and in date order — the Sales Register. */
export async function getSalesReport(): Promise<SalesReport> {
  let shopifyError: string | null = null;

  const [manualOrders, shopifyPage] = await Promise.all([
    prisma.order.findMany({
      where: { source: { in: ["manual", "mpesa_giftcard"] } },
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

  const rows: SalesRow[] = [
    ...manualOrders.map((order) => ({
      id: order.id,
      date: order.createdAt,
      customer: order.customer.name ?? order.customer.email,
      source: order.source === "mpesa_giftcard" ? "M-Pesa Gift Card" : "Manual",
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

  return { rows, shopifyError };
}

export function salesReportToCsv(rows: SalesRow[]): string {
  return rowsToCsv(
    ["Date", "Customer", "Source", "Total", "Currency"],
    rows.map((row) => [row.date.toISOString().slice(0, 10), row.customer, row.source, row.total.toFixed(2), row.currency]),
  );
}
