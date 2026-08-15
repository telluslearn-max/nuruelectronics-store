"use client";

import type { ExUkBrand } from "./use-ex-uk-brand";

const OPTIONS: { value: ExUkBrand; label: string }[] = [
  { value: "iphone", label: "iPhone" },
  { value: "android", label: "Android" },
  { value: "all", label: "All" },
];

/** Always-visible brand tabs on the Discover screen — lets a shopper jump between the iPhone and Android decks (or both) without going back through onboarding. */
export function ExUkBrandSwitcher({ value, onChange }: { value: ExUkBrand; onChange: (brand: ExUkBrand) => void }) {
  return (
    <div role="tablist" aria-label="Filter by brand" className="flex shrink-0 gap-1.5 border-b border-border-subtle px-3 py-2">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-control px-3 py-1.5 text-sm font-medium transition ${
            value === option.value ? "bg-accent text-accent-foreground" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
