"use client";

import { useTransition } from "react";
import { addItem } from "@/lib/actions";
import { trackEvent } from "@/lib/analytics/track-event";
import { useCart } from "./cart-context";

export function AddToCartButton({
  variantId,
  availableForSale,
  quantity = 1,
}: {
  variantId: string | undefined;
  availableForSale: boolean;
  quantity?: number;
}) {
  const { setCart, openCart } = useCart();
  const [isPending, startTransition] = useTransition();

  if (!variantId || !availableForSale) {
    return (
      <button
        disabled
        className="w-full cursor-not-allowed rounded-control bg-neutral-200 px-6 py-3.5 text-sm font-medium text-neutral-500"
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
          const cart = await addItem(variantId, quantity);
          setCart(cart);
          openCart();
          trackEvent("add_to_cart", {
            currency: cart.cost.totalAmount.currencyCode,
            items: [{ item_id: variantId, quantity }],
          });
        });
      }}
      className="w-full rounded-control bg-accent px-6 py-3.5 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
    >
      {isPending ? "Adding..." : "Add to cart"}
    </button>
  );
}
