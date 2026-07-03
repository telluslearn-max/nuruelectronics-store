"use client";

import { useTransition } from "react";
import { addItem } from "@/lib/actions";
import { useCart } from "./cart-context";

export function AddToCartButton({
  variantId,
  availableForSale,
}: {
  variantId: string;
  availableForSale: boolean;
}) {
  const { setCart, openCart } = useCart();
  const [isPending, startTransition] = useTransition();

  if (!availableForSale) {
    return (
      <button
        disabled
        className="w-full rounded-full bg-neutral-200 px-6 py-3 text-sm font-medium text-neutral-500 cursor-not-allowed"
      >
        Out of stock
      </button>
    );
  }

  return (
    <button
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const cart = await addItem(variantId, 1);
          setCart(cart);
          openCart();
        });
      }}
      className="w-full rounded-full bg-black px-6 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
    >
      {isPending ? "Adding..." : "Add to cart"}
    </button>
  );
}
