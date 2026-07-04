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
  selectedOptions: { name: string; value: string }[];
};

export type Product = {
  id: string;
  handle: string;
  title: string;
  description: string;
  descriptionHtml: string;
  availableForSale: boolean;
  productType: string;
  tags: string[];
  priceRange: {
    minVariantPrice: Money;
    maxVariantPrice: Money;
  };
  images: ProductImage[];
  variants: ProductVariant[];
  options: { id: string; name: string; values: string[] }[];
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

export type Cart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: {
    subtotalAmount: Money;
    totalAmount: Money;
  };
  lines: CartLine[];
};
