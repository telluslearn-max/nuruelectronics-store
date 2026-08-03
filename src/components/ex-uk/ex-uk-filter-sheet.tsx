"use client";

import { useEffect, useRef } from "react";
import { useFocusTrap } from "@/components/use-focus-trap";
import type { Category } from "@/lib/categories";

export function ExUkFilterSheet({
  categories,
  activeCategory,
  resultCount,
  onChangeCategory,
  onClose,
}: {
  categories: Category[];
  activeCategory: string | null;
  resultCount: number;
  onChangeCategory: (slug: string | null) => void;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(true);

  useEffect(() => {
    closeButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div ref={trapRef} role="dialog" aria-modal="true" aria-label="Filter Ex-UK units" className="fixed inset-0 z-50 flex flex-col bg-background">
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
            aria-pressed={activeCategory === null}
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
              aria-pressed={activeCategory === category.slug}
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
      </div>

      <div className="shrink-0 border-t border-border-subtle p-4">
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-control bg-accent py-3 text-sm font-medium text-accent-foreground"
        >
          Show {resultCount} {resultCount === 1 ? "result" : "results"}
        </button>
      </div>
    </div>
  );
}
