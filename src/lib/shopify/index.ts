import "server-only";
import type { Cart, CartLine, Product, ProductImage, ProductVariant } from "./types";
import {
  addToCartMutation,
  createCartMutation,
  getCartQuery,
  getProductByHandleQuery,
  getProductHandlesQuery,
  getProductsQuery,
  getProductsWithSpecsQuery,
  removeFromCartMutation,
  updateCartMutation,
} from "./queries";
import {
  findMockVariant,
  mockCarts,
  mockProducts,
  nextMockCartId,
  recalculateMockCart,
} from "./mock-data";

// Parses the simple query shapes this codebase generates (`product_type:"X"`,
// `tag:X`, joined with " OR ") so mock mode can exercise category/ecosystem/kit
// filters locally. Falls back to a title-substring match for freeform text,
// which is what the /search page passes.
export function matchesSearchTerm(product: Product, searchTerm: string): boolean {
  return searchTerm.split(" OR ").some((rawClause) => {
    const clause = rawClause.trim();
    if (clause.startsWith("product_type:")) {
      const value = clause.slice("product_type:".length).replace(/^"|"$/g, "");
      return product.productType.toLowerCase() === value.toLowerCase();
    }
    if (clause.startsWith("tag:")) {
      const value = clause.slice("tag:".length).replace(/^"|"$/g, "");
      return product.tags.some((tag) => tag.toLowerCase() === value.toLowerCase());
    }
    return product.title.toLowerCase().includes(clause.toLowerCase());
  });
}

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
const apiVersion = "2024-10";

export const isShopifyConfigured = Boolean(domain && token);

type Edge<T> = { node: T };
type Connection<T> = { edges: Edge<T>[] };
type PageInfo = { hasNextPage: boolean; endCursor: string | null };
type PaginatedConnection<T> = Connection<T> & { pageInfo: PageInfo };

export type ProductsPage = {
  products: Product[];
  hasNextPage: boolean;
  endCursor: string | null;
};

async function shopifyFetch<T>(
  query: string,
  variables?: Record<string, unknown>,
  options: { revalidate?: number } = {},
): Promise<T> {
  const res = await fetch(`https://${domain}/api/${apiVersion}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token as string,
    },
    body: JSON.stringify({ query, variables }),
    // Cart reads/mutations must never be cached; product reads opt into ISR.
    ...(options.revalidate !== undefined
      ? { next: { revalidate: options.revalidate } }
      : { cache: "no-store" as const }),
  });

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors.map((e: { message: string }) => e.message).join("\n"));
  }
  return json.data as T;
}

function reshapeImages(images: Connection<ProductImage>): ProductImage[] {
  return images.edges.map((edge) => edge.node);
}

function reshapeVariants(variants: Connection<ProductVariant>): ProductVariant[] {
  return variants.edges.map((edge) => edge.node);
}

function reshapeProduct(node: Omit<Product, "images" | "variants" | "specs"> & {
  images: Connection<ProductImage>;
  variants: Connection<ProductVariant>;
  metafields?: ({ key: string; value: string } | null)[];
}): Product {
  const { metafields, ...rest } = node;
  return {
    ...rest,
    images: reshapeImages(node.images),
    variants: reshapeVariants(node.variants),
    specs: metafields?.filter((m): m is { key: string; value: string } => m !== null) ?? [],
  };
}

type RawCartLine = Omit<CartLine, "merchandise"> & {
  merchandise: Omit<CartLine["merchandise"], "images"> & {
    product: {
      handle: string;
      title: string;
      images: Connection<ProductImage>;
    };
  };
};

function reshapeCart(node: Omit<Cart, "lines"> & { lines: Connection<RawCartLine> }): Cart {
  return {
    ...node,
    lines: node.lines.edges.map((edge) => ({
      ...edge.node,
      merchandise: {
        ...edge.node.merchandise,
        product: {
          ...edge.node.merchandise.product,
          images: reshapeImages(edge.node.merchandise.product.images),
        },
      },
    })),
  };
}

export async function getProducts(
  options: {
    after?: string;
    searchTerm?: string;
    sortKey?: "PRICE" | "TITLE" | "BEST_SELLING" | "CREATED_AT" | "RELEVANCE";
    reverse?: boolean;
    first?: number;
    /** Also fetch spec metafields per product (e.g. for the PDP comparison table). Adds query cost, so opt-in only. */
    includeSpecs?: boolean;
    /**
     * Ex-UK units (tag "ex-uk") are excluded from every general browse/search surface by
     * default — they're only meant to be discovered through the dedicated /ex-uk swipe
     * experience. Pass true for the few call sites that intentionally want them (the /ex-uk
     * page itself, and the ex-uk-counterpart lookup in src/lib/product-match.ts).
     */
    includeExUk?: boolean;
  } = {},
): Promise<ProductsPage> {
  const { after, searchTerm, sortKey, reverse, first, includeSpecs, includeExUk } = options;
  if (!isShopifyConfigured) {
    const products = mockProducts.filter((p) => {
      if (!includeExUk && p.tags.includes("ex-uk")) return false;
      return !searchTerm || matchesSearchTerm(p, searchTerm);
    });
    return { products, hasNextPage: false, endCursor: null };
  }
  const effectiveQuery = includeExUk ? searchTerm : searchTerm ? `(${searchTerm}) AND -tag:ex-uk` : "-tag:ex-uk";
  const data = await shopifyFetch<{
    products: PaginatedConnection<Parameters<typeof reshapeProduct>[0]>;
  }>(
    includeSpecs ? getProductsWithSpecsQuery : getProductsQuery,
    { after, query: effectiveQuery, sortKey, reverse, first },
    { revalidate: 60 },
  );
  return {
    products: data.products.edges.map((edge) => reshapeProduct(edge.node)),
    hasNextPage: data.products.pageInfo.hasNextPage,
    endCursor: data.products.pageInfo.endCursor,
  };
}

export async function getAllProductHandles(): Promise<{ handle: string; updatedAt?: string }[]> {
  if (!isShopifyConfigured) {
    // Mock catalog has no updatedAt — sitemap.ts falls back to a manual revision date for these.
    return mockProducts.map((p) => ({ handle: p.handle }));
  }
  const handles: { handle: string; updatedAt?: string }[] = [];
  let after: string | undefined;
  // Cap the loop defensively; the catalog is ~80 products today.
  for (let page = 0; page < 10; page++) {
    const data = await shopifyFetch<{
      products: PaginatedConnection<{ handle: string; updatedAt: string }>;
    }>(getProductHandlesQuery, { after }, { revalidate: 3600 });
    handles.push(
      ...data.products.edges.map((edge) => ({ handle: edge.node.handle, updatedAt: edge.node.updatedAt })),
    );
    if (!data.products.pageInfo.hasNextPage || !data.products.pageInfo.endCursor) break;
    after = data.products.pageInfo.endCursor;
  }
  return handles;
}

export async function getProductByHandle(handle: string): Promise<Product | null> {
  if (!isShopifyConfigured) {
    return mockProducts.find((p) => p.handle === handle) ?? null;
  }
  const data = await shopifyFetch<{ product: Parameters<typeof reshapeProduct>[0] | null }>(
    getProductByHandleQuery,
    { handle },
    { revalidate: 60 },
  );
  return data.product ? reshapeProduct(data.product) : null;
}

export async function createCart(lines: { merchandiseId: string; quantity: number }[] = []): Promise<Cart> {
  if (!isShopifyConfigured) {
    const id = nextMockCartId();
    const cartLines: CartLine[] = lines
      .map((line) => {
        const found = findMockVariant(line.merchandiseId);
        if (!found) return null;
        return buildMockLine(found.product, found.variant, line.quantity);
      })
      .filter((l): l is CartLine => l !== null);
    const cart = recalculateMockCart({
      id,
      checkoutUrl: `https://example-mock-checkout.myshopify.com/cart/c/${id}`,
      totalQuantity: 0,
      cost: { subtotalAmount: { amount: "0.00", currencyCode: "USD" }, totalAmount: { amount: "0.00", currencyCode: "USD" } },
      lines: cartLines,
    });
    mockCarts.set(id, cart);
    return cart;
  }
  const data = await shopifyFetch<{ cartCreate: { cart: Parameters<typeof reshapeCart>[0] } }>(
    createCartMutation,
    { lines },
  );
  return reshapeCart(data.cartCreate.cart);
}

export async function getCart(cartId: string): Promise<Cart | null> {
  if (!isShopifyConfigured) {
    return mockCarts.get(cartId) ?? null;
  }
  const data = await shopifyFetch<{ cart: Parameters<typeof reshapeCart>[0] | null }>(getCartQuery, { cartId });
  return data.cart ? reshapeCart(data.cart) : null;
}

function buildMockLine(product: Product, variant: ProductVariant, quantity: number): CartLine {
  const total = (Number(variant.price.amount) * quantity).toFixed(2);
  return {
    id: `gid://mock/CartLine/${variant.id}`,
    quantity,
    cost: { totalAmount: { amount: total, currencyCode: variant.price.currencyCode } },
    merchandise: {
      id: variant.id,
      title: variant.title,
      product: {
        handle: product.handle,
        title: product.title,
        images: product.images.slice(0, 1),
      },
    },
  };
}

export async function addToCart(
  cartId: string,
  lines: { merchandiseId: string; quantity: number }[],
): Promise<Cart> {
  if (!isShopifyConfigured) {
    const cart = mockCarts.get(cartId);
    if (!cart) throw new Error("Cart not found");
    for (const line of lines) {
      const found = findMockVariant(line.merchandiseId);
      if (!found) continue;
      const existing = cart.lines.find((l) => l.merchandise.id === line.merchandiseId);
      if (existing) {
        existing.quantity += line.quantity;
        existing.cost.totalAmount.amount = (Number(found.variant.price.amount) * existing.quantity).toFixed(2);
      } else {
        cart.lines.push(buildMockLine(found.product, found.variant, line.quantity));
      }
    }
    const updated = recalculateMockCart(cart);
    mockCarts.set(cartId, updated);
    return updated;
  }
  const data = await shopifyFetch<{ cartLinesAdd: { cart: Parameters<typeof reshapeCart>[0] } }>(
    addToCartMutation,
    { cartId, lines },
  );
  return reshapeCart(data.cartLinesAdd.cart);
}

export async function updateCartLine(cartId: string, lineId: string, quantity: number): Promise<Cart> {
  if (!isShopifyConfigured) {
    const cart = mockCarts.get(cartId);
    if (!cart) throw new Error("Cart not found");
    const line = cart.lines.find((l) => l.id === lineId);
    if (line) {
      const found = findMockVariant(line.merchandise.id);
      line.quantity = quantity;
      if (found) {
        line.cost.totalAmount.amount = (Number(found.variant.price.amount) * quantity).toFixed(2);
      }
    }
    const updated = recalculateMockCart(cart);
    mockCarts.set(cartId, updated);
    return updated;
  }
  const data = await shopifyFetch<{ cartLinesUpdate: { cart: Parameters<typeof reshapeCart>[0] } }>(
    updateCartMutation,
    { cartId, lines: [{ id: lineId, quantity }] },
  );
  return reshapeCart(data.cartLinesUpdate.cart);
}

export async function removeFromCart(cartId: string, lineId: string): Promise<Cart> {
  if (!isShopifyConfigured) {
    const cart = mockCarts.get(cartId);
    if (!cart) throw new Error("Cart not found");
    cart.lines = cart.lines.filter((l) => l.id !== lineId);
    const updated = recalculateMockCart(cart);
    mockCarts.set(cartId, updated);
    return updated;
  }
  const data = await shopifyFetch<{ cartLinesRemove: { cart: Parameters<typeof reshapeCart>[0] } }>(
    removeFromCartMutation,
    { cartId, lineIds: [lineId] },
  );
  return reshapeCart(data.cartLinesRemove.cart);
}
