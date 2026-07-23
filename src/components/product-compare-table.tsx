import Link from "next/link";
import { CompareTable } from "@/components/compare/compare-table";
import type { Product } from "@/lib/shopify/types";

/**
 * Spec comparison table: the viewed product plus its closest siblings
 * (same collection tag), side by side. Auto-populated — no shopper action
 * needed, unlike the user-driven "Add to compare" flow (see
 * src/components/compare/), which is a separate, complementary feature.
 */
export function ProductCompareTable({
  current,
  related,
}: {
  current: Product;
  related: Product[];
}) {
  const columns = [current, ...related].slice(0, 5);

  return (
    <CompareTable
      columns={columns}
      renderColumnHeader={(p) => {
        const isCurrent = p.handle === current.handle;
        return (
          <>
            {isCurrent ? (
              <p className="mt-2 text-sm font-semibold">{p.title}</p>
            ) : (
              <Link
                href={`/products/${p.handle}`}
                className="mt-2 block text-sm font-semibold text-accent hover:opacity-80"
              >
                {p.title}
              </Link>
            )}
            {isCurrent && (
              <span className="mt-1 inline-block rounded-control bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                Viewing
              </span>
            )}
          </>
        );
      }}
    />
  );
}
