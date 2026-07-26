"use client";

import type { Product } from "@/lib/shopify/types";
import { useCompare } from "./compare-context";

function CompareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <rect x="3" y="3" width="13" height="13" rx="2.5" />
      <rect x="8" y="8" width="13" height="13" rx="2.5" />
    </svg>
  );
}

export function CompareToggleButton({ product }: { product: Product }) {
  const { isComparing, isFull, toggleCompare } = useCompare();
  const active = isComparing(product.handle);
  const disabled = !active && isFull;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleCompare({ handle: product.handle, title: product.title, image: product.images[0]?.url });
      }}
      aria-label={active ? "Remove from compare" : disabled ? "Compare list is full" : "Add to compare"}
      aria-pressed={active}
      title={disabled ? "Compare list is full (max 3)" : undefined}
      className={`flex h-11 w-11 items-center justify-center rounded-full border shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border-subtle bg-background/90 text-neutral-600 hover:border-foreground hover:text-foreground"
      }`}
    >
      <CompareIcon className="h-4 w-4" />
    </button>
  );
}
