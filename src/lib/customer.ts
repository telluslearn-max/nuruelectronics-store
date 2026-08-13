import "server-only";
import type { Customer as DbCustomer } from "@prisma/client";
import { customerAccountFetch } from "./customer-account-api";
import { getValidAccessToken } from "./customer-auth";
import { prisma } from "./prisma";

export type CustomerOrder = {
  id: string;
  name: string;
  processedAt: string;
  financialStatus: string | null;
  fulfillmentStatus: string;
  totalPrice: { amount: string; currencyCode: string };
  lineItems: { title: string; quantity: number }[];
};

export type Customer = {
  id: string;
  displayName: string;
  email: string | null;
  orders: CustomerOrder[];
};

const CUSTOMER_QUERY = /* GraphQL */ `
  query CurrentCustomer {
    customer {
      id
      displayName
      emailAddress {
        emailAddress
      }
      orders(first: 10, sortKey: PROCESSED_AT, reverse: true) {
        edges {
          node {
            id
            name
            processedAt
            financialStatus
            fulfillmentStatus
            totalPrice {
              amount
              currencyCode
            }
            lineItems(first: 5) {
              edges {
                node {
                  title
                  quantity
                }
              }
            }
          }
        }
      }
    }
  }
`;

type RawOrder = {
  id: string;
  name: string;
  processedAt: string;
  financialStatus: string | null;
  fulfillmentStatus: string;
  totalPrice: { amount: string; currencyCode: string };
  lineItems: { edges: { node: { title: string; quantity: number } }[] };
};

export async function getCurrentCustomer(): Promise<Customer | null> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return null;

  const data = await customerAccountFetch<{
    customer: {
      id: string;
      displayName: string;
      emailAddress: { emailAddress: string } | null;
      orders: { edges: { node: RawOrder }[] };
    } | null;
  }>(accessToken, CUSTOMER_QUERY);

  if (!data.customer) return null;

  return {
    id: data.customer.id,
    displayName: data.customer.displayName,
    email: data.customer.emailAddress?.emailAddress ?? null,
    orders: data.customer.orders.edges.map((edge) => ({
      id: edge.node.id,
      name: edge.node.name,
      processedAt: edge.node.processedAt,
      financialStatus: edge.node.financialStatus,
      fulfillmentStatus: edge.node.fulfillmentStatus,
      totalPrice: edge.node.totalPrice,
      lineItems: edge.node.lineItems.edges.map((li) => ({
        title: li.node.title,
        quantity: li.node.quantity,
      })),
    })),
  };
}

const CUSTOMER_ID_QUERY = /* GraphQL */ `
  query CurrentCustomerId {
    customer {
      id
    }
  }
`;

/** Lean id-only lookup for the concierge's hot path (every turn) — avoids the heavier orders fetch in getCurrentCustomer(). */
export async function getCurrentCustomerId(): Promise<string | null> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return null;

  const data = await customerAccountFetch<{ customer: { id: string } | null }>(accessToken, CUSTOMER_ID_QUERY);
  return data.customer?.id ?? null;
}

const CUSTOMER_IDENTITY_QUERY = /* GraphQL */ `
  query CurrentCustomerIdentity {
    customer {
      id
      emailAddress {
        emailAddress
      }
    }
  }
`;

export type ShopifyCustomerIdentity = { id: string; email: string | null };

/** Leaner than getCurrentCustomer() (no orders) — for the customer-intelligence code paths (product
 * view logging, homepage recommendations) that only need to know *who*, not their order history. */
export async function getCurrentShopifyCustomerIdentity(): Promise<ShopifyCustomerIdentity | null> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return null;

  const data = await customerAccountFetch<{
    customer: { id: string; emailAddress: { emailAddress: string } | null } | null;
  }>(accessToken, CUSTOMER_IDENTITY_QUERY);
  if (!data.customer) return null;
  return { id: data.customer.id, email: data.customer.emailAddress?.emailAddress ?? null };
}

/**
 * Maps a signed-in Shopify shopper to our own Prisma `Customer` row (the id every `Interaction`,
 * `Order`, and admin page keys off), by email. Read-only — doesn't create a row, since most
 * customer-intelligence reads (recommendations, product-view logging) should only see a Customer
 * once one actually exists (see syncSignedInCustomer, which does create one, at sign-in).
 */
export async function getCurrentDbCustomerId(): Promise<string | null> {
  const identity = await getCurrentShopifyCustomerIdentity();
  if (!identity?.email) return null;
  const customer = await prisma.customer.findUnique({
    where: { email: identity.email.toLowerCase() },
    select: { id: true },
  });
  return customer?.id ?? null;
}

/**
 * Called once, right after a shopper completes Shopify Customer Account OAuth sign-in
 * (src/app/api/auth/callback/route.ts) — upserts our own Customer row for them (so lifecycle
 * tracking starts from first sign-in, not first purchase). The caller is responsible for then
 * backfilling this session's Interaction rows onto the returned customer id (see
 * backfillInteractionsForCustomer in src/lib/interactions.ts) — kept out of this function to avoid
 * a customer.ts <-> interactions.ts import cycle (interactions.ts itself depends on
 * getCurrentDbCustomerId above). Returns null (and logs) rather than throwing, so a sync failure
 * never breaks sign-in itself.
 */
export async function upsertSignedInCustomer(): Promise<DbCustomer | null> {
  try {
    const identity = await getCurrentShopifyCustomerIdentity();
    if (!identity?.email) return null;
    const email = identity.email.toLowerCase();

    return await prisma.customer.upsert({
      where: { email },
      create: { email, shopifyCustomerId: identity.id },
      update: { shopifyCustomerId: identity.id },
    });
  } catch (error) {
    console.error("Failed to upsert signed-in customer:", error);
    return null;
  }
}
