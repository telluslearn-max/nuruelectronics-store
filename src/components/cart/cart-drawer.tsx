"use client";

import { useEffect, useRef, useTransition } from "react";
import { removeItem, updateItemQuantity } from "@/lib/actions";
import { formatPrice } from "@/lib/format";
import { ProductMedia } from "@/components/product-media";
import { useCart } from "./cart-context";

export function CartDrawer() {
  const { cart, setCart, isOpen, closeCart } = useCart();
  const [isPending, startTransition] = useTransition();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeCart();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeCart]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Shopping cart"
    >
      <button
        aria-label="Close cart"
        className="absolute inset-0 animate-fade-in bg-black/40"
        onClick={closeCart}
      />
      <div className="relative flex h-full w-full max-w-md animate-slide-in flex-col bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border-subtle p-4">
          <h2 className="text-lg font-semibold">Your Cart</h2>
          <button
            ref={closeButtonRef}
            onClick={closeCart}
            aria-label="Close cart"
            className="flex h-9 w-9 items-center justify-center rounded-control text-2xl leading-none hover:bg-neutral-100"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!cart || cart.lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-neutral-500">Your cart is empty.</p>
              <button
                onClick={closeCart}
                className="mt-6 rounded-control border border-border-subtle px-6 py-2.5 text-sm font-medium transition hover:border-foreground"
              >
                Continue shopping
              </button>
            </div>
          ) : (
            <ul className="space-y-4">
              {cart.lines.map((line) => {
                const image = line.merchandise.product.images[0];
                return (
                  <li key={line.id} className="flex gap-4">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                      <ProductMedia
                        image={image}
                        title={line.merchandise.product.title}
                        sizes="80px"
                      />
                    </div>
                    <div className="flex flex-1 flex-col">
                      <p className="font-medium">{line.merchandise.product.title}</p>
                      {line.merchandise.title !== "Default" && (
                        <p className="text-sm text-neutral-500">{line.merchandise.title}</p>
                      )}
                      <div className="mt-auto flex items-center justify-between">
                        <div className="flex items-center gap-1 rounded-control border border-border-subtle px-1">
                          <button
                            disabled={isPending}
                            onClick={() =>
                              startTransition(async () => {
                                const updated = await updateItemQuantity(line.id, line.quantity - 1);
                                setCart(updated);
                              })
                            }
                            aria-label="Decrease quantity"
                            className="flex h-9 w-9 items-center justify-center text-sm disabled:opacity-50"
                          >
                            -
                          </button>
                          <span className="w-5 text-center text-sm">{line.quantity}</span>
                          <button
                            disabled={isPending}
                            onClick={() =>
                              startTransition(async () => {
                                const updated = await updateItemQuantity(line.id, line.quantity + 1);
                                setCart(updated);
                              })
                            }
                            aria-label="Increase quantity"
                            className="flex h-9 w-9 items-center justify-center text-sm disabled:opacity-50"
                          >
                            +
                          </button>
                        </div>
                        <p className="text-sm font-medium">
                          {formatPrice(line.cost.totalAmount.amount, line.cost.totalAmount.currencyCode)}
                        </p>
                      </div>
                    </div>
                    <button
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          const updated = await removeItem(line.id);
                          setCart(updated);
                        })
                      }
                      className="self-start text-sm text-neutral-400 hover:text-neutral-700"
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {cart && cart.lines.length > 0 && (
          <div className="border-t border-border-subtle p-4">
            <div className="mb-4 flex items-center justify-between text-sm">
              <span>Subtotal</span>
              <span className="font-medium">
                {formatPrice(cart.cost.subtotalAmount.amount, cart.cost.subtotalAmount.currencyCode)}
              </span>
            </div>
            <a
              href={cart.checkoutUrl}
              className="block w-full rounded-control bg-accent px-6 py-3 text-center text-sm font-medium text-accent-foreground transition hover:opacity-90"
            >
              Checkout
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
