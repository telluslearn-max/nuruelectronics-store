const productFragment = /* GraphQL */ `
  fragment productFields on Product {
    id
    handle
    title
    description
    descriptionHtml
    availableForSale
    productType
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
          price {
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

export const getProductByHandleQuery = /* GraphQL */ `
  ${productFragment}
  query getProductByHandle($handle: String!) {
    product(handle: $handle) {
      ...productFields
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
