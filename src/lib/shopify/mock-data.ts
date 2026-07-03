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
