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
    images: [],
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
    images: [],
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
    images: [],
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
    images: [],
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
    images: [],
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
    images: [],
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
    images: [],
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
    images: [],
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
    images: [],
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
    images: [],
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
    images: [],
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
    images: [],
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
  // Ex-UK line: unboxed units imported from the UK, sold with a 1-year
  // warranty. Tagged "ex-uk" so /ex-uk can filter with `tag:ex-uk` the same
  // way it will against the real Shopify catalog.
  {
    id: "gid://mock/Product/13",
    handle: "ex-uk-iphone-14-pro",
    title: "iPhone 14 Pro",
    description:
      "Unboxed ex-UK unit in excellent condition. Fully tested, factory reset, and covered by a 1-year warranty.",
    descriptionHtml:
      "<p>Unboxed ex-UK unit in excellent condition. Fully tested, factory reset, and covered by a 1-year warranty.</p>",
    availableForSale: true,
    productType: "Smartphones",
    tags: ["mock", "ex-uk"],
    priceRange: { minVariantPrice: money("699.00"), maxVariantPrice: money("699.00") },
    // Multiple images so the swipe card's dot pagination has something to page through locally.
    images: [
      { url: "https://picsum.photos/seed/exuk-iphone14pro-1/800/1000", altText: null, width: 800, height: 1000 },
      { url: "https://picsum.photos/seed/exuk-iphone14pro-2/800/1000", altText: null, width: 800, height: 1000 },
      { url: "https://picsum.photos/seed/exuk-iphone14pro-3/800/1000", altText: null, width: 800, height: 1000 },
    ],
    variants: [
      {
        id: "gid://mock/ProductVariant/14",
        title: "Default",
        availableForSale: true,
        price: money("699.00"),
        selectedOptions: [{ name: "Title", value: "Default" }],
      },
    ],
    options: [{ id: "1", name: "Title", values: ["Default"] }],
    specs: [
      { key: "processor", value: "A16 Bionic" },
      { key: "ram", value: "6GB" },
      { key: "storage", value: "256GB" },
      { key: "battery", value: "Up to 23h video playback" },
    ],
  },
  {
    id: "gid://mock/Product/14",
    handle: "ex-uk-galaxy-s23",
    title: "Samsung Galaxy S23",
    description:
      "Unboxed ex-UK unit, lightly used. Fully tested, factory reset, and covered by a 1-year warranty.",
    descriptionHtml:
      "<p>Unboxed ex-UK unit, lightly used. Fully tested, factory reset, and covered by a 1-year warranty.</p>",
    availableForSale: true,
    productType: "Smartphones",
    tags: ["mock", "ex-uk"],
    priceRange: { minVariantPrice: money("549.00"), maxVariantPrice: money("549.00") },
    images: [],
    variants: [
      {
        id: "gid://mock/ProductVariant/15",
        title: "Default",
        availableForSale: true,
        price: money("549.00"),
        selectedOptions: [{ name: "Title", value: "Default" }],
      },
    ],
    options: [{ id: "1", name: "Title", values: ["Default"] }],
    specs: [
      { key: "processor", value: "Snapdragon 8 Gen 2" },
      { key: "ram", value: "8GB" },
      { key: "storage", value: "256GB" },
      { key: "camera", value: "50MP triple camera" },
    ],
  },
  {
    id: "gid://mock/Product/15",
    handle: "ex-uk-macbook-pro-14-m2",
    title: 'MacBook Pro 14" M2',
    description:
      "Unboxed ex-UK unit in great cosmetic condition. Fully tested, factory reset, and covered by a 1-year warranty.",
    descriptionHtml:
      "<p>Unboxed ex-UK unit in great cosmetic condition. Fully tested, factory reset, and covered by a 1-year warranty.</p>",
    availableForSale: true,
    productType: "Laptops",
    tags: ["mock", "ex-uk"],
    priceRange: { minVariantPrice: money("1399.00"), maxVariantPrice: money("1399.00") },
    images: [],
    variants: [
      {
        id: "gid://mock/ProductVariant/16",
        title: "Default",
        availableForSale: true,
        price: money("1399.00"),
        selectedOptions: [{ name: "Title", value: "Default" }],
      },
    ],
    options: [{ id: "1", name: "Title", values: ["Default"] }],
    specs: [
      { key: "processor", value: "Apple M2" },
      { key: "ram", value: "16GB" },
      { key: "storage", value: "512GB SSD" },
      { key: "battery", value: "Up to 18h" },
    ],
  },
  {
    id: "gid://mock/Product/16",
    handle: "ex-uk-sony-wh1000xm5",
    title: "Sony WH-1000XM5",
    description:
      "Unboxed ex-UK unit, barely used. Fully tested, factory reset, and covered by a 1-year warranty.",
    descriptionHtml:
      "<p>Unboxed ex-UK unit, barely used. Fully tested, factory reset, and covered by a 1-year warranty.</p>",
    availableForSale: true,
    productType: "Audio",
    tags: ["mock", "ex-uk"],
    priceRange: { minVariantPrice: money("219.00"), maxVariantPrice: money("219.00") },
    images: [],
    variants: [
      {
        id: "gid://mock/ProductVariant/17",
        title: "Default",
        availableForSale: true,
        price: money("219.00"),
        selectedOptions: [{ name: "Title", value: "Default" }],
      },
    ],
    options: [{ id: "1", name: "Title", values: ["Default"] }],
    specs: [
      { key: "battery", value: "Up to 30h with ANC" },
      { key: "connectivity", value: "Bluetooth 5.2" },
    ],
  },
  {
    id: "gid://mock/Product/17",
    handle: "ex-uk-ipad-air-5",
    title: "iPad Air (5th Gen)",
    description:
      "Unboxed ex-UK unit in excellent condition. Fully tested, factory reset, and covered by a 1-year warranty.",
    descriptionHtml:
      "<p>Unboxed ex-UK unit in excellent condition. Fully tested, factory reset, and covered by a 1-year warranty.</p>",
    availableForSale: true,
    productType: "Tablets",
    tags: ["mock", "ex-uk"],
    priceRange: { minVariantPrice: money("449.00"), maxVariantPrice: money("449.00") },
    images: [],
    variants: [
      {
        id: "gid://mock/ProductVariant/18",
        title: "Default",
        availableForSale: true,
        price: money("449.00"),
        selectedOptions: [{ name: "Title", value: "Default" }],
      },
    ],
    options: [{ id: "1", name: "Title", values: ["Default"] }],
    specs: [
      { key: "processor", value: "Apple M1" },
      { key: "storage", value: "64GB" },
      { key: "display", value: "10.9-inch Liquid Retina" },
    ],
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
