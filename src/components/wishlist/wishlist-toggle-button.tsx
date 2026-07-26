"use client";

import { useEffect, useState } from "react";
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
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 1800);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const wasActive = active;
          toggleWishlist({ handle: product.handle, title: product.title, image: product.images[0]?.url });
          setMessage(wasActive ? "Removed from wishlist" : "Added to wishlist");
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
      {message && (
        <span
          role="status"
          className="pointer-events-none absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-control bg-foreground px-2.5 py-1 text-xs text-background shadow-md"
        >
          {message}
        </span>
      )}
    </span>
  );
}
