"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCompare } from "@/components/compare/compare-context";
import { ComparisonView } from "@/components/compare/comparison-view";
import { loadComparison } from "@/lib/intelligence/compare-action";
import type { ComparisonResultView } from "@/components/compare/comparison-result";

export function ComparePageClient() {
  const { items, removeFromCompare, clearCompare } = useCompare();
  const [loaded, setLoaded] = useState<{ key: string; view: ComparisonResultView } | null>(null);

  const key = items.map((i) => i.handle).join(",");

  useEffect(() => {
    if (items.length < 2) return;
    const handles = items.map((i) => i.handle);
    let cancelled = false;
    loadComparison(handles).then((view) => {
      if (!cancelled) setLoaded({ key: handles.join(","), view });
    });
    return () => {
      cancelled = true;
    };
  }, [items]);

  // Only trust a loaded result that matches the current compare list.
  const view = loaded && loaded.key === key ? loaded.view : null;

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-title">Compare</h1>
          <p className="mt-2 text-neutral-500">
            Side by side, with NURU&apos;s own scoring — and a personalised Fit Score when you tell us what matters.
          </p>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={clearCompare}
            className="shrink-0 rounded-control border border-border-subtle px-4 py-2 text-sm font-medium transition hover:border-foreground"
          >
            Clear all
          </button>
        )}
      </div>

      {items.length < 2 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-neutral-500">
            {items.length === 0
              ? "You haven't added anything to compare yet."
              : "Add one more product to start comparing."}
          </p>
          <Link
            href="/shop"
            className="mt-8 rounded-control bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
          >
            Browse products
          </Link>
        </div>
      ) : view === null ? (
        <div
          className="mt-10 grid gap-4"
          style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        >
          {items.map((item) => (
            <div key={item.handle}>
              <div className="aspect-square animate-pulse rounded-card bg-neutral-100" />
              <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-neutral-100" />
              <div className="mt-2 h-8 w-full animate-pulse rounded-control bg-neutral-100" />
            </div>
          ))}
        </div>
      ) : (
        <ComparisonView view={view} onRemove={removeFromCompare} />
      )}
    </div>
  );
}
