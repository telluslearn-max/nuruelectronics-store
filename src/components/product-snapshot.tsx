import { CategoryIcon, SPEC_CATEGORIES, SPEC_LABELS } from "@/components/product-specs";
import type { ProductSpec } from "@/lib/shopify/types";

const MAX_SNAPSHOT_ENTRIES = 4;

/**
 * A few real headline specs shown right under the price, ahead of the full
 * Specifications section further down the page. Takes at most one entry per
 * category (in SPEC_CATEGORIES order) so the snapshot spans different kinds
 * of specs rather than repeating the same group — never fabricated, just
 * resurfaced from data the page already has.
 */
export function ProductSnapshot({ specs }: { specs: ProductSpec[] }) {
  if (specs.length === 0) return null;

  const specMap = new Map(specs.map((s) => [s.key, s.value]));
  const entries: { categoryId: string; key: string; value: string }[] = [];

  for (const category of SPEC_CATEGORIES) {
    if (entries.length >= MAX_SNAPSHOT_ENTRIES) break;
    const key = category.keys.find((k) => specMap.has(k));
    if (key) entries.push({ categoryId: category.id, key, value: specMap.get(key)! });
  }

  if (entries.length === 0) return null;

  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {entries.map((entry) => (
        <div key={entry.key} className="flex items-start gap-2">
          <CategoryIcon id={entry.categoryId} className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div className="min-w-0">
            <p className="text-xs text-neutral-500">{SPEC_LABELS[entry.key] ?? entry.key}</p>
            <p className="truncate text-sm font-medium">{entry.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
