export type Money = {
  amount: string;
  currencyCode: string;
};

export type ProductImage = {
  url: string;
  altText: string | null;
  width: number;
  height: number;
};

export type ProductVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  price: Money;
  compareAtPrice?: Money | null;
  selectedOptions: { name: string; value: string }[];
  sku?: string | null;
};

export type ProductSpec = {
  key: string;
  value: string;
};

export type Product = {
  id: string;
  handle: string;
  title: string;
  description: string;
  descriptionHtml: string;
  availableForSale: boolean;
  productType: string;
  vendor?: string;
  tags: string[];
  priceRange: {
    minVariantPrice: Money;
    maxVariantPrice: Money;
  };
  compareAtPriceRange?: {
    minVariantPrice: Money;
    maxVariantPrice: Money;
  } | null;
  images: ProductImage[];
  variants: ProductVariant[];
  options: { id: string; name: string; values: string[] }[];
  /** Structured spec metafields (namespace "specs") — populated on the single-product fetch, and on list fetches that opt in via `includeSpecs`. */
  specs?: ProductSpec[];
  /** From the "availability.release_date" metafield — set only on tag:coming-soon products. */
  releaseDate?: string;
};

export type CartLine = {
  id: string;
  quantity: number;
  cost: {
    totalAmount: Money;
  };
  merchandise: {
    id: string;
    title: string;
    product: {
      handle: string;
      title: string;
      images: ProductImage[];
    };
  };
};

export type Article = {
  id: string;
  handle: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  publishedAt: string;
  image?: { url: string; altText: string | null; width: number; height: number } | null;
  tags: string[];
  author?: string;
};

export type Cart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: {
    subtotalAmount: Money;
    totalAmount: Money;
  };
  lines: CartLine[];
  /** Cart-level key/value tags, e.g. { key: "concierge_assisted", value: "true" } set when the AI concierge helps build the cart — flows through to the completed order's customAttributes. */
  attributes: { key: string; value: string }[];
};
