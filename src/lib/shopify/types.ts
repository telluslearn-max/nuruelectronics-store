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
  /**
   * From the "bnpl.deposit" / "bnpl.installment" / "bnpl.term_count" / "bnpl.term_unit"
   * metafields — our BNPL partner's (Wuezesha's) own fixed figures for this variant, used
   * verbatim via `buildPartnerBnplPlan` instead of the in-house formula in `calculateBnplPlan`.
   * Only set when all four metafields are present and valid. `processingFee` and
   * `insurancePerPeriod` are optional breakdown detail (from "bnpl.processing_fee" /
   * "bnpl.insurance_per_period") — already included in `deposit`/`installment`, itemized here
   * only for display, matching how Wuezesha's own UI discloses them. `referencePrice` (from
   * "bnpl.reference_price") is Wuezesha's own price basis for this variant — often different
   * from our `price` above — shown for context only, never used in any calculation.
   */
  bnplOverride?: {
    deposit: Money;
    installment: Money;
    termCount: number;
    termUnit: "week" | "month";
    processingFee?: Money;
    insurancePerPeriod?: Money;
    referencePrice?: Money;
  } | null;
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
