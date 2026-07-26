"use client";

import type { Product } from "@/lib/shopify/types";
import { useWishlist } from "./wishlist-context";

function HeartIcon({ className, filled }: { className?: string; filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20.5s-7.5-4.7-10-9.3C.6 8 1.9 4.5 5 3.4c2-.7 4 0 5.5 1.9C12 3.4 14 2.7 16 3.4c3.1 1.1 4.4 4.6 3 7.8-2.5 4.6-10 9.3-10 9.3Z" />
    </svg>
  );
}

export function WishlistToggleButton({ product }: { product: Product }) {
  const { isSaved, toggleWishlist } = useWishlist();
  const active = isSaved(product.handle);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleWishlist({ handle: product.handle, title: product.title, image: product.images[0]?.url });
      }}
      aria-label={active ? "Remove from wishlist" : "Save to wishlist"}
      aria-pressed={active}
      className={`flex h-11 w-11 items-center justify-center rounded-full border shadow-sm transition ${
        active
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border-subtle bg-background/90 text-neutral-600 hover:border-foreground hover:text-foreground"
      }`}
    >
      <HeartIcon className="h-4 w-4" filled={active} />
    </button>
  );
}
