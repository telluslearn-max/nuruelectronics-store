"use client";

import { useEffect, useRef, useTransition } from "react";
import { removeItem, updateItemQuantity } from "@/lib/actions";
import { trackEvent } from "@/lib/analytics/track-event";
import { formatPrice } from "@/lib/format";
import { ProductMedia } from "@/components/product-media";
import { useFocusTrap } from "@/components/use-focus-trap";
import { useCart } from "./cart-context";

export function CartDrawer() {
  const { cart, setCart, isOpen, closeCart } = useCart();
  const [isPending, startTransition] = useTransition();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(isOpen);

  useEffect(() => {
    if (!isOpen) return;

    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeCart();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeCart]);

  useEffect(() => {
    if (!isOpen) return;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end md:flex-row md:justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Shopping cart"
    >
      <button
        aria-label="Close cart"
        className="absolute inset-0 animate-fade-in bg-black/40"
        onClick={closeCart}
      />
      <div
        ref={trapRef}
        className="relative flex w-full max-h-[75vh] animate-slide-up flex-col rounded-t-card border border-b-0 border-border-subtle bg-background shadow-xl md:h-full md:max-h-full md:max-w-md md:animate-slide-in md:rounded-t-none md:border-0"
      >
        <div className="flex items-center justify-between border-b border-border-subtle p-4">
          <h2 className="text-lg font-semibold">Your Cart</h2>
          <button
            ref={closeButtonRef}
            onClick={closeCart}
            aria-label="Close cart"
            className="flex h-11 w-11 items-center justify-center rounded-control text-2xl leading-none hover:bg-neutral-100"
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
                        <div className="flex items-center gap-2 rounded-control border border-border-subtle px-1">
                          <button
                            disabled={isPending}
                            onClick={() =>
                              startTransition(async () => {
                                const updated = await updateItemQuantity(line.id, line.quantity - 1);
                                setCart(updated);
                              })
                            }
                            aria-label="Decrease quantity"
                            className="flex h-11 w-11 items-center justify-center text-sm disabled:opacity-50"
                          >
                            -
                          </button>
                          <span className="w-5 text-center text-sm" aria-live="polite">
                            {line.quantity}
                          </span>
                          <button
                            disabled={isPending}
                            onClick={() =>
                              startTransition(async () => {
                                const updated = await updateItemQuantity(line.id, line.quantity + 1);
                                setCart(updated);
                              })
                            }
                            aria-label="Increase quantity"
                            className="flex h-11 w-11 items-center justify-center text-sm disabled:opacity-50"
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
                      className="-m-2 self-start p-2 text-sm text-neutral-400 hover:text-neutral-700"
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
              <span className="font-medium" aria-live="polite">
                {formatPrice(cart.cost.subtotalAmount.amount, cart.cost.subtotalAmount.currencyCode)}{" "}
                <span className="text-xs font-normal text-neutral-400" title="VAT is calculated and added at checkout.">excl. VAT</span>
              </span>
            </div>
            <a
              href={cart.checkoutUrl}
              onClick={() =>
                trackEvent("begin_checkout", {
                  currency: cart.cost.totalAmount.currencyCode,
                  value: Number(cart.cost.totalAmount.amount),
                })
              }
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
