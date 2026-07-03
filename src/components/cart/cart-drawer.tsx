"use client";

import Image from "next/image";
import { useTransition } from "react";
import { removeItem, updateItemQuantity } from "@/lib/actions";
import { useCart } from "./cart-context";

function formatPrice(amount: string, currencyCode: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(
    Number(amount),
  );
}

export function CartDrawer() {
  const { cart, setCart, isOpen, closeCart } = useCart();
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Close cart"
        className="absolute inset-0 bg-black/40"
        onClick={closeCart}
      />
      <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">Your Cart</h2>
          <button onClick={closeCart} className="text-2xl leading-none">
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!cart || cart.lines.length === 0 ? (
            <p className="text-neutral-500">Your cart is empty.</p>
          ) : (
            <ul className="space-y-4">
              {cart.lines.map((line) => {
                const image = line.merchandise.product.images[0];
                return (
                  <li key={line.id} className="flex gap-4">
                    {image && (
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded bg-neutral-100">
                        <Image
                          src={image.url}
                          alt={image.altText ?? line.merchandise.product.title}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col">
                      <p className="font-medium">{line.merchandise.product.title}</p>
                      {line.merchandise.title !== "Default" && (
                        <p className="text-sm text-neutral-500">{line.merchandise.title}</p>
                      )}
                      <div className="mt-auto flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            disabled={isPending}
                            onClick={() =>
                              startTransition(async () => {
                                const updated = await updateItemQuantity(line.id, line.quantity - 1);
                                setCart(updated);
                              })
                            }
                            className="h-6 w-6 rounded-full border text-sm disabled:opacity-50"
                          >
                            -
                          </button>
                          <span className="text-sm">{line.quantity}</span>
                          <button
                            disabled={isPending}
                            onClick={() =>
                              startTransition(async () => {
                                const updated = await updateItemQuantity(line.id, line.quantity + 1);
                                setCart(updated);
                              })
                            }
                            className="h-6 w-6 rounded-full border text-sm disabled:opacity-50"
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
          <div className="border-t p-4">
            <div className="mb-4 flex items-center justify-between text-sm">
              <span>Subtotal</span>
              <span className="font-medium">
                {formatPrice(cart.cost.subtotalAmount.amount, cart.cost.subtotalAmount.currencyCode)}
              </span>
            </div>
            <a
              href={cart.checkoutUrl}
              className="block w-full rounded-full bg-black px-6 py-3 text-center text-sm font-medium text-white transition hover:opacity-90"
            >
              Checkout
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
