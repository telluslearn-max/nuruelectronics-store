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

// Used by the optional inventory sync (§15): a variant's inventory item id
// plus its first tracked location, which `inventoryAdjustQuantities` needs.
export const getVariantInventoryInfoQuery = /* GraphQL */ `
  query GetVariantInventoryInfo($id: ID!) {
    productVariant(id: $id) {
      id
      inventoryItem {
        id
        inventoryLevels(first: 1) {
          edges {
            node {
              location {
                id
              }
            }
          }
        }
      }
    }
  }
`;

export const inventoryAdjustQuantitiesMutation = /* GraphQL */ `
  mutation AdjustInventory($input: InventoryAdjustQuantitiesInput!) {
    inventoryAdjustQuantities(input: $input) {
      userErrors {
        field
        message
      }
    }
  }
`;
