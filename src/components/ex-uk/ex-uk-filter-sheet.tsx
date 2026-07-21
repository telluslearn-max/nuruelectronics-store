"use client";

import { useEffect, useRef } from "react";
import type { Category } from "@/lib/categories";

const PRICE_PRESETS = [
  { label: "Any price", value: null },
  { label: "Under $300", value: 300 },
  { label: "Under $600", value: 600 },
  { label: "Under $1000", value: 1000 },
];

export function ExUkFilterSheet({
  categories,
  activeCategory,
  maxPrice,
  onChangeCategory,
  onChangeMaxPrice,
  onClose,
}: {
  categories: Category[];
  activeCategory: string | null;
  maxPrice: number | null;
  onChangeCategory: (slug: string | null) => void;
  onChangeMaxPrice: (price: number | null) => void;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Filter Ex-UK units" className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-4 py-3">
        <span className="text-sm font-semibold">Filters</span>
        <button
          ref={closeButtonRef}
          onClick={onClose}
          aria-label="Close filters"
          className="flex h-9 w-9 items-center justify-center rounded-control text-2xl leading-none hover:bg-neutral-100"
        >
          &times;
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Category</h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChangeCategory(null)}
            className={`rounded-control border px-3 py-1.5 text-sm ${
              activeCategory === null ? "border-accent bg-accent/10 text-accent" : "border-border-subtle text-neutral-600"
            }`}
          >
            All categories
          </button>
          {categories.map((category) => (
            <button
              key={category.slug}
              type="button"
              onClick={() => onChangeCategory(category.slug)}
              className={`rounded-control border px-3 py-1.5 text-sm ${
                activeCategory === category.slug
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border-subtle text-neutral-600"
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>

        <h3 className="mb-2 mt-6 text-xs font-medium uppercase tracking-wide text-neutral-500">Price</h3>
        <div className="flex flex-wrap gap-2">
          {PRICE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onChangeMaxPrice(preset.value)}
              className={`rounded-control border px-3 py-1.5 text-sm ${
                maxPrice === preset.value ? "border-accent bg-accent/10 text-accent" : "border-border-subtle text-neutral-600"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t border-border-subtle p-4">
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-control bg-accent py-3 text-sm font-medium text-accent-foreground"
        >
          Show results
        </button>
      </div>
    </div>
  );
}
