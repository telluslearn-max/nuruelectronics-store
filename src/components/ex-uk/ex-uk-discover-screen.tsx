"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { categoryForProductType, type Category } from "@/lib/categories";
import { brandForProduct } from "@/lib/ex-uk-brand";
import type { Savings } from "@/lib/product-match";
import type { Product } from "@/lib/shopify/types";
import { ExUkBrandOnboarding } from "./ex-uk-brand-onboarding";
import { ExUkBrandSwitcher } from "./ex-uk-brand-switcher";
import { ExUkFilterSheet } from "./ex-uk-filter-sheet";
import { ExUkTopBar } from "./ex-uk-top-bar";
import { ExUkLocalStorageNotice } from "./local-storage-notice";
import { SwipeDeck } from "./swipe-deck";
import { useExUkBrand } from "./use-ex-uk-brand";

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path strokeLinecap="round" d="M3 5h14M6 10h8M8.5 15h3" />
    </svg>
  );
}

export function ExUkDiscoverScreen({
  products,
  savingsByHandle,
}: {
  products: Product[];
  savingsByHandle: Record<string, Savings>;
}) {
  const searchParams = useSearchParams();
  const highlightHandle = searchParams.get("highlight");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const { brand, setBrand, hydrated } = useExUkBrand();

  // A shopper who arrived via a deep link (e.g. the concierge recommending a specific unit)
  // shouldn't be blocked by onboarding or have their highlighted product filtered out by a brand
  // they haven't chosen yet — show everything for this visit without persisting that choice.
  const effectiveBrand = brand ?? (highlightHandle ? "all" : null);

  const availableCategories = useMemo(() => {
    const bySlug = new Map<string, Category>();
    for (const product of products) {
      const category = categoryForProductType(product.productType);
      if (category) bySlug.set(category.slug, category);
    }
    return Array.from(bySlug.values());
  }, [products]);

  const filteredProducts = useMemo(() => {
    let list = products.filter((product) => {
      if (activeCategory && categoryForProductType(product.productType)?.slug !== activeCategory) return false;
      if (effectiveBrand && effectiveBrand !== "all" && brandForProduct(product) !== effectiveBrand) return false;
      return true;
    });

    if (highlightHandle) {
      const index = list.findIndex((p) => p.handle === highlightHandle);
      if (index > 0) {
        const [highlighted] = list.splice(index, 1);
        list = [highlighted, ...list];
      }
    }

    return list;
  }, [products, activeCategory, effectiveBrand, highlightHandle]);

  const isFiltered = activeCategory !== null || (effectiveBrand !== null && effectiveBrand !== "all");

  function clearFilters() {
    setActiveCategory(null);
    setBrand("all");
  }

  if (!hydrated) return null;

  if (effectiveBrand === null) {
    return (
      <>
        <ExUkTopBar title="Ex-UK" />
        <ExUkBrandOnboarding onChoose={setBrand} />
      </>
    );
  }

  return (
    <>
      <ExUkTopBar
        title="Ex-UK"
        rightSlot={
          <button
            type="button"
            aria-label="Filter Ex-UK units"
            onClick={() => setFilterOpen(true)}
            className={`relative flex h-9 w-9 items-center justify-center rounded-control ${
              isFiltered ? "text-accent" : "text-neutral-500"
            } hover:bg-neutral-100`}
          >
            <FilterIcon className="h-5 w-5" />
            {isFiltered && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />}
          </button>
        }
      />
      <ExUkBrandSwitcher value={effectiveBrand} onChange={setBrand} />
      <ExUkLocalStorageNotice />
      <div className="flex flex-1 flex-col overflow-hidden">
        <SwipeDeck
          products={filteredProducts}
          savingsByHandle={savingsByHandle}
          isFiltered={isFiltered}
          onClearFilters={clearFilters}
          highlightHandle={highlightHandle}
        />
      </div>

      {filterOpen && (
        <ExUkFilterSheet
          categories={availableCategories}
          activeCategory={activeCategory}
          resultCount={filteredProducts.length}
          onChangeCategory={setActiveCategory}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </>
  );
}
