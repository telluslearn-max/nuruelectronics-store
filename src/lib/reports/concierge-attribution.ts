import "server-only";
import { getShopifyOrders, isConciergeAssistedOrder, isShopifyAdminConfigured } from "../shopify/admin-api";
import { rowsToCsv } from "./csv";

export type ConciergeAttributionRow = {
  id: string;
  date: Date;
  customer: string;
  source: string;
  total: number;
  currency: string;
  conciergeAssisted: boolean;
};

export type ConciergeAttributionSummary = {
  totalOrders: number;
  totalGmv: number;
  assistedOrders: number;
  assistedGmv: number;
  /** Share of orders/GMV that were AI-concierge-assisted, 0-1. */
  assistedOrderShare: number;
  assistedGmvShare: number;
};

export type ConciergeAttributionReport = {
  rows: ConciergeAttributionRow[];
  summary: ConciergeAttributionSummary;
  shopifyError: string | null;
};

function summarize(rows: ConciergeAttributionRow[]): ConciergeAttributionSummary {
  const totalOrders = rows.length;
  const totalGmv = rows.reduce((sum, row) => sum + row.total, 0);
  const assisted = rows.filter((row) => row.conciergeAssisted);
  const assistedOrders = assisted.length;
  const assistedGmv = assisted.reduce((sum, row) => sum + row.total, 0);
  return {
    totalOrders,
    totalGmv,
    assistedOrders,
    assistedGmv,
    assistedOrderShare: totalOrders > 0 ? assistedOrders / totalOrders : 0,
    assistedGmvShare: totalGmv > 0 ? assistedGmv / totalGmv : 0,
  };
}

/**
 * AI-attribution view of Shopify orders — which ones were touched by the concierge
 * (cart-level `concierge_assisted` attribute set in src/lib/actions.ts, flows through
 * to the completed order's customAttributes). Manual/WhatsApp orders never go through
 * the storefront cart, so they can't carry the attribute and are excluded here — this
 * report is specifically about the AI concierge's Shopify-checkout impact.
 */
export async function getConciergeAttributionReport(): Promise<ConciergeAttributionReport> {
  if (!isShopifyAdminConfigured) {
    return { rows: [], summary: summarize([]), shopifyError: null };
  }

  let shopifyError: string | null = null;
  const shopifyPage = await getShopifyOrders({ first: 100 }).catch((error: unknown) => {
    shopifyError = error instanceof Error ? error.message : "Unknown error";
    return { orders: [], hasNextPage: false, endCursor: null };
  });

  const rows: ConciergeAttributionRow[] = shopifyPage.orders
    .map((order) => ({
      id: order.id,
      date: new Date(order.processedAt),
      customer: order.customer?.displayName ?? "—",
      source: order.name,
      total: Number(order.currentTotalPriceSet.shopMoney.amount),
      currency: order.currentTotalPriceSet.shopMoney.currencyCode,
      conciergeAssisted: isConciergeAssistedOrder(order),
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  return { rows, summary: summarize(rows), shopifyError };
}

export function conciergeAttributionReportToCsv(rows: ConciergeAttributionRow[]): string {
  return rowsToCsv(
    ["Date", "Customer", "Order", "Total", "Currency", "AI Concierge Assisted"],
    rows.map((row) => [
      row.date.toISOString().slice(0, 10),
      row.customer,
      row.source,
      row.total.toFixed(2),
      row.currency,
      row.conciergeAssisted ? "Yes" : "No",
    ]),
  );
}
