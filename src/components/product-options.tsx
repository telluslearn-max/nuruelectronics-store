"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { useCart } from "@/components/cart/cart-context";
import { WhatsAppOrderButton } from "@/components/whatsapp-order-button";
import { formatPrice } from "@/lib/format";
import type { Product, ProductVariant } from "@/lib/shopify/types";

function variantLabel(variant: ProductVariant | undefined) {
  if (!variant) return undefined;
  const label = variant.selectedOptions
    .filter((o) => o.value !== "Default")
    .map((o) => o.value)
    .join(", ");
  return label || undefined;
}

function variantMatches(variant: ProductVariant, selected: Record<string, string>) {
  return variant.selectedOptions.every((option) => selected[option.name] === option.value);
}

export function ProductOptions({ product }: { product: Product }) {
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const initial = product.variants[0]?.selectedOptions ?? [];
    return Object.fromEntries(initial.map((o) => [o.name, o.value]));
  });
  const [quantity, setQuantity] = useState(1);
  const [buyBlockVisible, setBuyBlockVisible] = useState(true);
  const buyBlockRef = useRef<HTMLDivElement>(null);
  const { isOpen: cartIsOpen } = useCart();

  const selectedVariant = useMemo(
    () => product.variants.find((v) => variantMatches(v, selected)),
    [product.variants, selected],
  );

  const showOptions = product.options.some((option) => option.values.length > 1);
  const price = selectedVariant?.price ?? product.priceRange.minVariantPrice;

  useEffect(() => {
    const el = buyBlockRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      setBuyBlockVisible(entry.isIntersecting);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function resolveVariant(optionName: string, value: string) {
    return product.variants.find((v) => variantMatches(v, { ...selected, [optionName]: value }));
  }

  function isValueAvailable(optionName: string, value: string) {
    const candidate = { ...selected, [optionName]: value };
    return product.variants.some((v) => v.availableForSale && variantMatches(v, candidate));
  }

  function optionHasPriceSpread(optionName: string, values: string[]) {
    const prices = new Set(
      values
        .map((value) => resolveVariant(optionName, value)?.price.amount)
        .filter((amount): amount is string => amount !== undefined),
    );
    return prices.size > 1;
  }

  const showStickyBar = !buyBlockVisible && !cartIsOpen && Boolean(selectedVariant);

  return (
    <div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-lg text-neutral-700">
          {formatPrice(price.amount, price.currencyCode)}{" "}
          <span className="text-xs font-normal text-neutral-400" title="VAT is calculated and added at checkout.">excl. VAT</span>
        </p>
        <span
          className={`text-sm font-medium ${
            selectedVariant?.availableForSale ? "text-accent" : "text-neutral-400"
          }`}
        >
          {selectedVariant?.availableForSale ? "In stock" : "Out of stock"}
        </span>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        Same-day delivery in Nairobi &bull; Countrywide shipping available
      </p>

      {showOptions && (
        <div className="mt-6 space-y-5">
          {product.options.map((option) => {
            const showPrices = optionHasPriceSpread(option.name, option.values);
            return (
              <div key={option.id}>
                <p className="mb-2 text-sm font-medium">{option.name}</p>
                <div className="flex flex-wrap gap-2">
                  {option.values.map((value) => {
                    const isSelected = selected[option.name] === value;
                    const available = isValueAvailable(option.name, value);
                    const valuePrice = showPrices
                      ? resolveVariant(option.name, value)?.price
                      : undefined;
                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={!available}
                        onClick={() => setSelected((prev) => ({ ...prev, [option.name]: value }))}
                        className={`rounded-card border px-4 py-2.5 text-left text-sm transition ${
                          isSelected
                            ? "border-foreground bg-foreground text-background"
                            : "border-border-subtle hover:border-foreground"
                        } ${!available ? "cursor-not-allowed opacity-40 line-through" : ""}`}
                      >
                        <span className="block font-medium">{value}</span>
                        {valuePrice && (
                          <span
                            className={`mt-0.5 block text-xs ${
                              isSelected ? "text-background/70" : "text-neutral-500"
                            }`}
                          >
                            {formatPrice(valuePrice.amount, valuePrice.currencyCode)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
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

      <div ref={buyBlockRef} className="mt-8 space-y-3">
        <AddToCartButton
          variantId={selectedVariant?.id}
          availableForSale={selectedVariant?.availableForSale ?? false}
          quantity={quantity}
        />
        <WhatsAppOrderButton
          productTitle={product.title}
          variantLabel={variantLabel(selectedVariant)}
          price={formatPrice(price.amount, price.currencyCode)}
          productHandle={product.handle}
        />
      </div>

      {showStickyBar && (
        <div className="fixed inset-x-0 bottom-0 z-30 animate-fade-up border-t border-border-subtle bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{product.title}</p>
              <p className="text-sm text-neutral-500">
                {formatPrice(price.amount, price.currencyCode)}{" "}
                <span className="text-xs text-neutral-400" title="VAT is calculated and added at checkout.">excl. VAT</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <WhatsAppOrderButton
                productTitle={product.title}
                variantLabel={variantLabel(selectedVariant)}
                price={formatPrice(price.amount, price.currencyCode)}
                productHandle={product.handle}
                compact
              />
              <div className="w-36 sm:w-44">
                <AddToCartButton
                  variantId={selectedVariant?.id}
                  availableForSale={selectedVariant?.availableForSale ?? false}
                  quantity={quantity}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
