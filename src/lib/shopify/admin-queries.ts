const orderFields = `
  id
  name
  processedAt
  displayFinancialStatus
  displayFulfillmentStatus
  currentTotalPriceSet {
    shopMoney { amount currencyCode }
  }
  customer {
    id
    email
    displayName
  }
  lineItems(first: 50) {
    edges {
      node {
        title
        quantity
        variant { id title }
        originalUnitPriceSet { shopMoney { amount currencyCode } }
      }
    }
  }
`;

export const getOrdersQuery = /* GraphQL */ `
  query GetOrders($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query, sortKey: PROCESSED_AT, reverse: true) {
      edges {
        node {
          ${orderFields}
          totalTaxSet {
            shopMoney { amount currencyCode }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const getOrderByIdQuery = /* GraphQL */ `
  query GetOrder($id: ID!) {
    order(id: $id) {
      ${orderFields}
    }
  }
`;
