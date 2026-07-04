"use client";

import { useMemo, useState } from "react";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { formatPrice } from "@/lib/format";
import type { Product, ProductVariant } from "@/lib/shopify/types";

function variantMatches(variant: ProductVariant, selected: Record<string, string>) {
  return variant.selectedOptions.every((option) => selected[option.name] === option.value);
}

export function ProductOptions({ product }: { product: Product }) {
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const initial = product.variants[0]?.selectedOptions ?? [];
    return Object.fromEntries(initial.map((o) => [o.name, o.value]));
  });
  const [quantity, setQuantity] = useState(1);

  const selectedVariant = useMemo(
    () => product.variants.find((v) => variantMatches(v, selected)),
    [product.variants, selected],
  );

  const showOptions = product.options.some((option) => option.values.length > 1);
  const price = selectedVariant?.price ?? product.priceRange.minVariantPrice;

  function isValueAvailable(optionName: string, value: string) {
    const candidate = { ...selected, [optionName]: value };
    return product.variants.some((v) => v.availableForSale && variantMatches(v, candidate));
  }

  return (
    <div>
      <p className="mt-2 text-lg text-neutral-700">
        {formatPrice(price.amount, price.currencyCode)}
      </p>

      {showOptions && (
        <div className="mt-6 space-y-5">
          {product.options.map((option) => (
            <div key={option.id}>
              <p className="mb-2 text-sm font-medium">{option.name}</p>
              <div className="flex flex-wrap gap-2">
                {option.values.map((value) => {
                  const isSelected = selected[option.name] === value;
                  const available = isValueAvailable(option.name, value);
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={!available}
                      onClick={() => setSelected((prev) => ({ ...prev, [option.name]: value }))}
                      className={`rounded-control border px-4 py-2 text-sm transition ${
                        isSelected
                          ? "border-foreground bg-foreground text-background"
                          : "border-border-subtle hover:border-foreground"
                      } ${!available ? "cursor-not-allowed opacity-40 line-through" : ""}`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium">Quantity</p>
        <div className="inline-flex items-center gap-3 rounded-control border border-border-subtle px-1">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
            className="flex h-11 w-11 items-center justify-center text-lg"
          >
            &minus;
          </button>
          <span className="w-6 text-center text-sm">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => q + 1)}
            aria-label="Increase quantity"
            className="flex h-11 w-11 items-center justify-center text-lg"
          >
            +
          </button>
        </div>
      </div>

      <div className="mt-8">
        <AddToCartButton
          variantId={selectedVariant?.id}
          availableForSale={selectedVariant?.availableForSale ?? false}
          quantity={quantity}
        />
      </div>
    </div>
  );
}
