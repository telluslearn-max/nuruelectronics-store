"use client";

import Link from "next/link";
import { useCart } from "./cart/cart-context";

export function Nav() {
  const { cart, openCart } = useCart();
  const itemCount = cart?.totalQuantity ?? 0;

  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Store
        </Link>
        <button
          onClick={openCart}
          aria-label={`Open cart${itemCount > 0 ? `, ${itemCount} items` : ""}`}
          className="relative rounded-control border border-border-subtle px-4 py-2 text-sm font-medium transition hover:border-foreground"
        >
          Cart
          {itemCount > 0 && (
            <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-control bg-accent text-xs text-accent-foreground">
              {itemCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
