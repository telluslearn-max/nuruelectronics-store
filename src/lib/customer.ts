import "server-only";
import { customerAccountFetch } from "./customer-account-api";
import { getValidAccessToken } from "./customer-auth";

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
  displayName: string;
  email: string | null;
  orders: CustomerOrder[];
};

const CUSTOMER_QUERY = /* GraphQL */ `
  query CurrentCustomer {
    customer {
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
      displayName: string;
      emailAddress: { emailAddress: string } | null;
      orders: { edges: { node: RawOrder }[] };
    } | null;
  }>(accessToken, CUSTOMER_QUERY);

  if (!data.customer) return null;

  return {
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
