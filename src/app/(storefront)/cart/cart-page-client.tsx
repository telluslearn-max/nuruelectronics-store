"use client";

import Link from "next/link";
import { useTransition } from "react";
import { removeItem, updateItemQuantity } from "@/lib/actions";
import { trackEvent } from "@/lib/analytics/track-event";
import { isCheckoutUsable } from "@/lib/checkout";
import { buildWhatsAppHandoffMessage } from "@/lib/concierge/whatsapp-tool";
import { formatPrice } from "@/lib/format";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { ProductMedia } from "@/components/product-media";
import { useCart } from "@/components/cart/cart-context";

export function CartPageClient() {
  const { cart, setCart } = useCart();
  const [isPending, startTransition] = useTransition();

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h1 className="text-title">Your cart is empty</h1>
        <p className="mt-2 max-w-sm text-neutral-500">
          Browse the shop and add something you like — it&apos;ll show up here.
        </p>
        <Link
          href="/shop"
          className="mt-8 rounded-control bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
        >
          Browse products
        </Link>
      </div>
    );
  }

  const checkoutUsable = isCheckoutUsable(cart.checkoutUrl);
  const whatsappCheckoutHref = buildWhatsAppUrl(
    buildWhatsAppHandoffMessage({ summary: "I'd like to check out.", cart }),
  );

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-title">Your Cart</h1>

      <ul className="mt-8 space-y-6 divide-y divide-border-subtle">
        {cart.lines.map((line) => {
          const image = line.merchandise.product.images[0];
          return (
            <li key={line.id} className="flex gap-4 pt-6 first:pt-0">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                <ProductMedia image={image} title={line.merchandise.product.title} sizes="96px" />
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
                  <p className="font-medium">
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

      <div className="mt-10 rounded-card border border-border-subtle p-6">
        <div className="flex items-center justify-between text-sm">
          <span>Subtotal</span>
          <span className="font-medium" aria-live="polite">
            {formatPrice(cart.cost.subtotalAmount.amount, cart.cost.subtotalAmount.currencyCode)}{" "}
            <span className="text-xs font-normal text-neutral-400" title="VAT is calculated and added at checkout.">
              excl. VAT
            </span>
          </span>
        </div>
        {checkoutUsable ? (
          <a
            href={cart.checkoutUrl}
            onClick={() =>
              trackEvent("begin_checkout", {
                currency: cart.cost.totalAmount.currencyCode,
                value: Number(cart.cost.totalAmount.amount),
              })
            }
            className="mt-4 block w-full rounded-control bg-accent px-6 py-3 text-center text-sm font-medium text-accent-foreground transition hover:opacity-90"
          >
            Checkout
          </a>
        ) : whatsappCheckoutHref ? (
          <a
            href={whatsappCheckoutHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackEvent("begin_checkout", {
                currency: cart.cost.totalAmount.currencyCode,
                value: Number(cart.cost.totalAmount.amount),
              })
            }
            className="mt-4 block w-full rounded-control bg-accent px-6 py-3 text-center text-sm font-medium text-accent-foreground transition hover:opacity-90"
          >
            Order via WhatsApp
          </a>
        ) : (
          <p className="mt-4 text-center text-sm text-red-600" role="alert">
            Checkout is temporarily unavailable — please contact support.
          </p>
        )}
        <Link
          href="/shop"
          className="mt-3 block text-center text-sm text-neutral-500 underline hover:text-foreground"
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
