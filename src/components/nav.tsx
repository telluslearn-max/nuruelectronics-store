"use client";

import Link from "next/link";
import { useCart } from "./cart/cart-context";

export function Nav() {
  const { cart, openCart } = useCart();
  const itemCount = cart?.totalQuantity ?? 0;

  return (
    <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Store
        </Link>
        <button
          onClick={openCart}
          className="relative rounded-full border px-4 py-2 text-sm font-medium hover:bg-neutral-50"
        >
          Cart
          {itemCount > 0 && (
            <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black text-xs text-white">
              {itemCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
