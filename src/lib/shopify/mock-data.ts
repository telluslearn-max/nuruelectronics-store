import type { Cart, Product } from "./types";

function money(amount: string): { amount: string; currencyCode: string } {
  return { amount, currencyCode: "USD" };
}

export const mockProducts: Product[] = [
  {
    id: "gid://mock/Product/1",
    handle: "canvas-tote-bag",
    title: "Canvas Tote Bag",
    description: "A durable canvas tote for everyday carry.",
    descriptionHtml: "<p>A durable canvas tote for everyday carry.</p>",
    availableForSale: true,
    productType: "Accessories",
    tags: ["mock"],
    priceRange: { minVariantPrice: money("28.00"), maxVariantPrice: money("28.00") },
    images: [
      { url: "https://picsum.photos/seed/tote/800/800", altText: "Canvas Tote Bag", width: 800, height: 800 },
    ],
    variants: [
      {
        id: "gid://mock/ProductVariant/1",
        title: "Default",
        availableForSale: true,
        price: money("28.00"),
        selectedOptions: [{ name: "Title", value: "Default" }],
      },
    ],
    options: [{ id: "1", name: "Title", values: ["Default"] }],
  },
  {
    id: "gid://mock/Product/2",
    handle: "ceramic-mug",
    title: "Ceramic Mug",
    description: "A minimalist ceramic mug, dishwasher safe.",
    descriptionHtml: "<p>A minimalist ceramic mug, dishwasher safe.</p>",
    availableForSale: true,
    productType: "Accessories",
    tags: ["mock"],
    priceRange: { minVariantPrice: money("18.00"), maxVariantPrice: money("18.00") },
    images: [
      { url: "https://picsum.photos/seed/mug/800/800", altText: "Ceramic Mug", width: 800, height: 800 },
    ],
    variants: [
      {
        id: "gid://mock/ProductVariant/2",
        title: "Default",
        availableForSale: true,
        price: money("18.00"),
        selectedOptions: [{ name: "Title", value: "Default" }],
      },
    ],
    options: [{ id: "1", name: "Title", values: ["Default"] }],
  },
  {
    id: "gid://mock/Product/3",
    handle: "wool-beanie",
    title: "Wool Beanie",
    description: "A warm wool beanie, one size fits most.",
    descriptionHtml: "<p>A warm wool beanie, one size fits most.</p>",
    availableForSale: true,
    productType: "Accessories",
    tags: ["mock"],
    priceRange: { minVariantPrice: money("24.00"), maxVariantPrice: money("24.00") },
    images: [
      { url: "https://picsum.photos/seed/beanie/800/800", altText: "Wool Beanie", width: 800, height: 800 },
    ],
    variants: [
      {
        id: "gid://mock/ProductVariant/3",
        title: "Black",
        availableForSale: true,
        price: money("24.00"),
        selectedOptions: [{ name: "Color", value: "Black" }],
      },
      {
        id: "gid://mock/ProductVariant/4",
        title: "Grey",
        availableForSale: true,
        price: money("24.00"),
        selectedOptions: [{ name: "Color", value: "Grey" }],
      },
    ],
    options: [{ id: "1", name: "Color", values: ["Black", "Grey"] }],
  },
  {
    id: "gid://mock/Product/4",
    handle: "leather-wallet",
    title: "Leather Wallet",
    description: "A slim bifold leather wallet.",
    descriptionHtml: "<p>A slim bifold leather wallet.</p>",
    availableForSale: true,
    productType: "Accessories",
    tags: ["mock"],
    priceRange: { minVariantPrice: money("45.00"), maxVariantPrice: money("45.00") },
    images: [
      { url: "https://picsum.photos/seed/wallet/800/800", altText: "Leather Wallet", width: 800, height: 800 },
    ],
    variants: [
      {
        id: "gid://mock/ProductVariant/5",
        title: "Default",
        availableForSale: true,
        price: money("45.00"),
        selectedOptions: [{ name: "Title", value: "Default" }],
      },
    ],
    options: [{ id: "1", name: "Title", values: ["Default"] }],
  },
  {
    id: "gid://mock/Product/5",
    handle: "sunglasses",
    title: "Classic Sunglasses",
    description: "UV400 protection, polarized lenses.",
    descriptionHtml: "<p>UV400 protection, polarized lenses.</p>",
    availableForSale: true,
    productType: "Accessories",
    tags: ["mock"],
    priceRange: { minVariantPrice: money("32.00"), maxVariantPrice: money("32.00") },
    images: [
      { url: "https://picsum.photos/seed/sunglasses/800/800", altText: "Classic Sunglasses", width: 800, height: 800 },
    ],
    variants: [
      {
        id: "gid://mock/ProductVariant/6",
        title: "Default",
        availableForSale: true,
        price: money("32.00"),
        selectedOptions: [{ name: "Title", value: "Default" }],
      },
    ],
    options: [{ id: "1", name: "Title", values: ["Default"] }],
  },
  {
    id: "gid://mock/Product/6",
    handle: "water-bottle",
    title: "Insulated Water Bottle",
    description: "Keeps drinks cold for 24 hours.",
    descriptionHtml: "<p>Keeps drinks cold for 24 hours.</p>",
    availableForSale: true,
    productType: "Accessories",
    tags: ["mock"],
    priceRange: { minVariantPrice: money("22.00"), maxVariantPrice: money("22.00") },
    images: [
      { url: "https://picsum.photos/seed/bottle/800/800", altText: "Insulated Water Bottle", width: 800, height: 800 },
    ],
    variants: [
      {
        id: "gid://mock/ProductVariant/7",
        title: "Default",
        availableForSale: true,
        price: money("22.00"),
        selectedOptions: [{ name: "Title", value: "Default" }],
      },
    ],
    options: [{ id: "1", name: "Title", values: ["Default"] }],
  },
  // The rest exercise the multi-brand taxonomy (categories, ecosystems, kits)
  // added alongside the Samsung-only catalog, for local dev without real
  // Shopify credentials.
  {
    id: "gid://mock/Product/7",
    handle: "iphone-17-pro",
    title: "iPhone 17 Pro",
    description: "Apple's flagship phone with a titanium frame.",
    descriptionHtml: "<p>Apple's flagship phone with a titanium frame.</p>",
    availableForSale: true,
    productType: "Smartphones",
    tags: ["mock", "apple", "ecosystem-apple", "collection-iphone-17-series"],
    priceRange: { minVariantPrice: money("1199.00"), maxVariantPrice: money("1199.00") },
    images: [
      { url: "https://picsum.photos/seed/iphone17pro/800/800", altText: "iPhone 17 Pro", width: 800, height: 800 },
    ],
    variants: [
      {
        id: "gid://mock/ProductVariant/8",
        title: "Default",
        availableForSale: true,
        price: money("1199.00"),
        selectedOptions: [{ name: "Title", value: "Default" }],
      },
    ],
    options: [{ id: "1", name: "Title", values: ["Default"] }],
  },
  {
    id: "gid://mock/Product/8",
    handle: "macbook-air-15",
    title: "MacBook Air 15\"",
    description: "Thin, light, and fast enough for everyday work.",
    descriptionHtml: "<p>Thin, light, and fast enough for everyday work.</p>",
    availableForSale: true,
    productType: "Laptops",
    tags: ["mock", "apple", "ecosystem-apple", "collection-mac", "kit-work-study"],
    priceRange: { minVariantPrice: money("1299.00"), maxVariantPrice: money("1299.00") },
    images: [
      { url: "https://picsum.photos/seed/macbookair15/800/800", altText: "MacBook Air 15", width: 800, height: 800 },
    ],
    variants: [
      {
        id: "gid://mock/ProductVariant/9",
        title: "Default",
        availableForSale: true,
        price: money("1299.00"),
        selectedOptions: [{ name: "Title", value: "Default" }],
      },
    ],
    options: [{ id: "1", name: "Title", values: ["Default"] }],
  },
  {
    id: "gid://mock/Product/9",
    handle: "nintendo-switch-2",
    title: "Nintendo Switch 2",
    description: "Nintendo's next-generation hybrid console.",
    descriptionHtml: "<p>Nintendo's next-generation hybrid console.</p>",
    availableForSale: true,
    productType: "Gaming Consoles",
    tags: ["mock", "nintendo", "kit-gaming"],
    priceRange: { minVariantPrice: money("449.00"), maxVariantPrice: money("449.00") },
    images: [
      { url: "https://picsum.photos/seed/switch2/800/800", altText: "Nintendo Switch 2", width: 800, height: 800 },
    ],
    variants: [
      {
        id: "gid://mock/ProductVariant/10",
        title: "Default",
        availableForSale: true,
        price: money("449.00"),
        selectedOptions: [{ name: "Title", value: "Default" }],
      },
    ],
    options: [{ id: "1", name: "Title", values: ["Default"] }],
  },
  {
    id: "gid://mock/Product/10",
    handle: "canon-eos-r50",
    title: "Canon EOS R50",
    description: "A lightweight mirrorless camera built for content creators.",
    descriptionHtml: "<p>A lightweight mirrorless camera built for content creators.</p>",
    availableForSale: true,
    productType: "Cameras",
    tags: ["mock", "canon", "kit-content-creator"],
    priceRange: { minVariantPrice: money("799.00"), maxVariantPrice: money("799.00") },
    images: [
      { url: "https://picsum.photos/seed/eosr50/800/800", altText: "Canon EOS R50", width: 800, height: 800 },
    ],
    variants: [
      {
        id: "gid://mock/ProductVariant/11",
        title: "Default",
        availableForSale: true,
        price: money("799.00"),
        selectedOptions: [{ name: "Title", value: "Default" }],
      },
    ],
    options: [{ id: "1", name: "Title", values: ["Default"] }],
  },
  {
    id: "gid://mock/Product/11",
    handle: "tcl-55-qled-tv",
    title: "TCL 55\" QLED TV",
    description: "A vibrant 4K QLED TV for movie nights.",
    descriptionHtml: "<p>A vibrant 4K QLED TV for movie nights.</p>",
    availableForSale: true,
    productType: "Televisions",
    tags: ["mock", "tcl", "kit-home-theater"],
    priceRange: { minVariantPrice: money("649.00"), maxVariantPrice: money("649.00") },
    images: [
      { url: "https://picsum.photos/seed/tcl55qled/800/800", altText: "TCL 55 inch QLED TV", width: 800, height: 800 },
    ],
    variants: [
      {
        id: "gid://mock/ProductVariant/12",
        title: "Default",
        availableForSale: true,
        price: money("649.00"),
        selectedOptions: [{ name: "Title", value: "Default" }],
      },
    ],
    options: [{ id: "1", name: "Title", values: ["Default"] }],
  },
  {
    id: "gid://mock/Product/12",
    handle: "anker-power-bank-20000mah",
    title: "Anker Power Bank 20000mAh",
    description: "High-capacity power bank for phones and laptops.",
    descriptionHtml: "<p>High-capacity power bank for phones and laptops.</p>",
    availableForSale: true,
    productType: "Power Banks",
    tags: ["mock", "anker", "kit-power-charging"],
    priceRange: { minVariantPrice: money("59.00"), maxVariantPrice: money("59.00") },
    images: [
      { url: "https://picsum.photos/seed/ankerpowerbank/800/800", altText: "Anker Power Bank 20000mAh", width: 800, height: 800 },
    ],
    variants: [
      {
        id: "gid://mock/ProductVariant/13",
        title: "Default",
        availableForSale: true,
        price: money("59.00"),
        selectedOptions: [{ name: "Title", value: "Default" }],
      },
    ],
    options: [{ id: "1", name: "Title", values: ["Default"] }],
  },
];

// In-memory mock cart store, keyed by cart id. Resets on server restart -
// fine for local testing before real Shopify credentials are wired in.
export const mockCarts = new Map<string, Cart>();

let mockCartCounter = 0;

export function nextMockCartId(): string {
  mockCartCounter += 1;
  return `gid://mock/Cart/${mockCartCounter}`;
}

export function findMockVariant(variantId: string): { product: Product; variant: Product["variants"][number] } | null {
  for (const product of mockProducts) {
    const variant = product.variants.find((v) => v.id === variantId);
    if (variant) return { product, variant };
  }
  return null;
}

export function recalculateMockCart(cart: Cart): Cart {
  const totalQuantity = cart.lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cart.lines.reduce((sum, line) => sum + Number(line.cost.totalAmount.amount), 0);
  return {
    ...cart,
    totalQuantity,
    cost: {
      subtotalAmount: money(subtotal.toFixed(2)),
      totalAmount: money(subtotal.toFixed(2)),
    },
  };
}
