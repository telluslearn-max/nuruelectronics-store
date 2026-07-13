import "server-only";
import { getOrderByIdQuery, getOrdersQuery } from "./admin-queries";

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const adminToken = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
const apiVersion = "2024-10";

export const isShopifyAdminConfigured = Boolean(domain && adminToken);

type Edge<T> = { node: T };
type Connection<T> = { edges: Edge<T>[] };
type PageInfo = { hasNextPage: boolean; endCursor: string | null };
type PaginatedConnection<T> = Connection<T> & { pageInfo: PageInfo };

export type ShopifyAdminOrderLineItem = {
  title: string;
  quantity: number;
  variant: { id: string; title: string } | null;
  originalUnitPriceSet: { shopMoney: { amount: string; currencyCode: string } };
};

export type ShopifyAdminOrder = {
  id: string;
  name: string;
  processedAt: string;
  displayFinancialStatus: string;
  displayFulfillmentStatus: string;
  currentTotalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  customer: { id: string; email: string | null; displayName: string } | null;
  lineItems: Connection<ShopifyAdminOrderLineItem>;
  totalTaxSet?: { shopMoney: { amount: string; currencyCode: string } };
};

export type ShopifyAdminOrdersPage = {
  orders: ShopifyAdminOrder[];
  hasNextPage: boolean;
  endCursor: string | null;
};

async function shopifyAdminFetch<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://${domain}/admin/api/${apiVersion}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": adminToken as string,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors.map((e: { message: string }) => e.message).join("\n"));
  }
  return json.data as T;
}

export async function getShopifyOrders(
  options: { after?: string; first?: number; query?: string } = {},
): Promise<ShopifyAdminOrdersPage> {
  if (!isShopifyAdminConfigured) {
    return { orders: [], hasNextPage: false, endCursor: null };
  }
  const { after, first = 25, query } = options;
  const data = await shopifyAdminFetch<{ orders: PaginatedConnection<ShopifyAdminOrder> }>(getOrdersQuery, {
    first,
    after,
    query,
  });
  return {
    orders: data.orders.edges.map((edge) => edge.node),
    hasNextPage: data.orders.pageInfo.hasNextPage,
    endCursor: data.orders.pageInfo.endCursor,
  };
}

export async function getShopifyOrderById(id: string): Promise<ShopifyAdminOrder | null> {
  if (!isShopifyAdminConfigured) return null;
  const data = await shopifyAdminFetch<{ order: ShopifyAdminOrder | null }>(getOrderByIdQuery, { id });
  return data.order;
}

function paidOrdersInRangeQuery(from: Date, to: Date): string {
  return `processed_at:>='${from.toISOString()}' AND processed_at:<'${to.toISOString()}' AND financial_status:paid`;
}

async function getAllShopifyOrdersMatching(query: string): Promise<ShopifyAdminOrder[]> {
  const results: ShopifyAdminOrder[] = [];
  let after: string | undefined;
  // Defensive page cap; a small store's paid-order volume per reporting window won't approach this.
  for (let page = 0; page < 40; page++) {
    const data = await shopifyAdminFetch<{ orders: PaginatedConnection<ShopifyAdminOrder> }>(getOrdersQuery, {
      first: 100,
      after,
      query,
    });
    results.push(...data.orders.edges.map((edge) => edge.node));
    if (!data.orders.pageInfo.hasNextPage || !data.orders.pageInfo.endCursor) break;
    after = data.orders.pageInfo.endCursor;
  }
  return results;
}

export type ShopifyOrderTaxSummary = {
  id: string;
  processedAt: string;
  totalTax: { amount: string; currencyCode: string };
};

/** Tax collected on paid Shopify orders within [from, to), for the combined Tax Record report (§14). */
export async function getShopifyTaxCollected(from: Date, to: Date): Promise<ShopifyOrderTaxSummary[]> {
  if (!isShopifyAdminConfigured) return [];
  const orders = await getAllShopifyOrdersMatching(paidOrdersInRangeQuery(from, to));
  return orders.map((order) => ({
    id: order.id,
    processedAt: order.processedAt,
    totalTax: order.totalTaxSet?.shopMoney ?? { amount: "0", currencyCode: order.currentTotalPriceSet.shopMoney.currencyCode },
  }));
}

/** Shopify orders paid within [from, to), for cash-basis revenue recognition in the P&L sync (§12). */
export async function getShopifyPaidOrderTotals(
  from: Date,
  to: Date,
): Promise<{ processedAt: string; amount: string; currencyCode: string }[]> {
  if (!isShopifyAdminConfigured) return [];
  const orders = await getAllShopifyOrdersMatching(paidOrdersInRangeQuery(from, to));
  return orders.map((order) => ({
    processedAt: order.processedAt,
    amount: order.currentTotalPriceSet.shopMoney.amount,
    currencyCode: order.currentTotalPriceSet.shopMoney.currencyCode,
  }));
}
