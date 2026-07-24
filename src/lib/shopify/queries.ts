const productFragment = /* GraphQL */ `
  fragment productFields on Product {
    id
    handle
    title
    description
    descriptionHtml
    availableForSale
    productType
    vendor
    tags
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
      maxVariantPrice {
        amount
        currencyCode
      }
    }
    compareAtPriceRange {
      minVariantPrice {
        amount
        currencyCode
      }
      maxVariantPrice {
        amount
        currencyCode
      }
    }
    images(first: 10) {
      edges {
        node {
          url
          altText
          width
          height
        }
      }
    }
    variants(first: 100) {
      edges {
        node {
          id
          title
          availableForSale
          sku
          price {
            amount
            currencyCode
          }
          compareAtPrice {
            amount
            currencyCode
          }
          selectedOptions {
            name
            value
          }
        }
      }
    }
    options {
      id
      name
      values
    }
  }
`;

const cartFragment = /* GraphQL */ `
  fragment cartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    cost {
      subtotalAmount {
        amount
        currencyCode
      }
      totalAmount {
        amount
        currencyCode
      }
    }
    lines(first: 100) {
      edges {
        node {
          id
          quantity
          cost {
            totalAmount {
              amount
              currencyCode
            }
          }
          merchandise {
            ... on ProductVariant {
              id
              title
              product {
                handle
                title
                images(first: 1) {
                  edges {
                    node {
                      url
                      altText
                      width
                      height
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const getProductsQuery = /* GraphQL */ `
  ${productFragment}
  query getProducts($first: Int = 24, $after: String, $query: String, $sortKey: ProductSortKeys, $reverse: Boolean) {
    products(first: $first, after: $after, query: $query, sortKey: $sortKey, reverse: $reverse) {
      edges {
        node {
          ...productFields
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const getProductHandlesQuery = /* GraphQL */ `
  query getProductHandles($first: Int = 100, $after: String) {
    products(first: $first, after: $after) {
      edges {
        node {
          handle
          updatedAt
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

// Shared across any query that needs spec metafields, so the single-product
// page and multi-product fetches (e.g. the PDP comparison table's related
// products) stay in sync with the same key list.
const specsMetafieldsBlock = `
  metafields(identifiers: [
    # Compute (phones, tablets, computers, gaming)
    { namespace: "specs", key: "processor" }
    { namespace: "specs", key: "ram" }
    { namespace: "specs", key: "storage" }
    { namespace: "specs", key: "os" }
    # Display / imaging (phones, tablets, computers, TVs, cameras, gaming)
    { namespace: "specs", key: "display" }
    { namespace: "specs", key: "resolution" }
    { namespace: "specs", key: "camera" }
    { namespace: "specs", key: "sensor" }
    # Audio (earbuds, headphones, speakers, soundbars)
    { namespace: "specs", key: "driver_size" }
    # Audio (microphones)
    { namespace: "specs", key: "polar_pattern" }
    { namespace: "specs", key: "frequency_response" }
    # Power (phones, tablets, wearables, audio, cameras, chargers, power banks)
    { namespace: "specs", key: "battery" }
    { namespace: "specs", key: "output_power" }
    { namespace: "specs", key: "capacity" }
    # Connectivity & fit (broad)
    { namespace: "specs", key: "connectivity" }
    { namespace: "specs", key: "compatibility" }
    { namespace: "specs", key: "water_resistance" }
    # Physical (broad)
    { namespace: "specs", key: "dimensions" }
    { namespace: "specs", key: "weight" }
    { namespace: "specs", key: "material" }
    # Appliances & everything else
    { namespace: "specs", key: "energy_rating" }
    { namespace: "specs", key: "included_in_box" }
    # Games
    { namespace: "specs", key: "publisher" }
    { namespace: "specs", key: "developer" }
    { namespace: "specs", key: "release_date" }
    { namespace: "specs", key: "multiplayer" }
    { namespace: "specs", key: "age_rating" }
    { namespace: "specs", key: "languages" }
  ]) {
    key
    value
  }
`;

export const getProductByHandleQuery = /* GraphQL */ `
  ${productFragment}
  query getProductByHandle($handle: String!) {
    product(handle: $handle) {
      ...productFields
      ${specsMetafieldsBlock}
    }
  }
`;

// Same shape as getProductsQuery, but also pulls spec metafields per product.
// Used where specs feed into UI (e.g. the PDP comparison table) rather than
// the default product-listing fetch, since the metafields lookup adds cost
// to every product in the page and most listings don't need it.
export const getProductsWithSpecsQuery = /* GraphQL */ `
  ${productFragment}
  query getProductsWithSpecs($first: Int = 24, $after: String, $query: String, $sortKey: ProductSortKeys, $reverse: Boolean) {
    products(first: $first, after: $after, query: $query, sortKey: $sortKey, reverse: $reverse) {
      edges {
        node {
          ...productFields
          ${specsMetafieldsBlock}
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const createCartMutation = /* GraphQL */ `
  ${cartFragment}
  mutation createCart($lines: [CartLineInput!]) {
    cartCreate(input: { lines: $lines }) {
      cart {
        ...cartFields
      }
    }
  }
`;

export const getCartQuery = /* GraphQL */ `
  ${cartFragment}
  query getCart($cartId: ID!) {
    cart(id: $cartId) {
      ...cartFields
    }
  }
`;

export const addToCartMutation = /* GraphQL */ `
  ${cartFragment}
  mutation addToCart($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        ...cartFields
      }
    }
  }
`;

export const updateCartMutation = /* GraphQL */ `
  ${cartFragment}
  mutation updateCart($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart {
        ...cartFields
      }
    }
  }
`;

export const removeFromCartMutation = /* GraphQL */ `
  ${cartFragment}
  mutation removeFromCart($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart {
        ...cartFields
      }
    }
  }
`;
