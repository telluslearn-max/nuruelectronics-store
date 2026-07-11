import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { SPEC_LABELS } from "@/components/product-specs";
import type { Product } from "@/lib/shopify/types";

// SPEC_LABELS is grouped by category in declaration order (compute, display,
// audio, power, connectivity, physical, appliances) — reuse that order here
// so comparison rows read in the same sensible sequence as the PDP's own
// Specifications section.
const SPEC_KEY_ORDER = Object.keys(SPEC_LABELS);

/**
 * Spec comparison table: the viewed product plus its closest siblings
 * (same collection tag), side by side. Rows are built from real product
 * data only — price, each product's own option axes (Storage, Color, ...),
 * spec metafields, and availability — nothing fabricated. A spec row only
 * appears if at least one column actually has that value set.
 */
export function ProductCompareTable({
  current,
  related,
}: {
  current: Product;
  related: Product[];
}) {
  const columns = [current, ...related].slice(0, 5);

  // "Title" is Shopify's auto-assigned option name for products with no real
  // customer-facing options (single "Default Title" variant) — not a useful
  // comparison row, so it's excluded.
  const optionNames = Array.from(
    new Set(columns.flatMap((p) => p.options.map((o) => o.name))),
  ).filter((name) => name !== "Title");

  const specsByHandle = new Map(
    columns.map((p) => [p.handle, new Map((p.specs ?? []).map((s) => [s.key, s.value]))]),
  );
  const specKeys = SPEC_KEY_ORDER.filter((key) =>
    columns.some((p) => specsByHandle.get(p.handle)?.has(key)),
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 w-32 bg-background" />
            {columns.map((p) => {
              const isCurrent = p.handle === current.handle;
              return (
                <th key={p.handle} scope="col" className="w-40 px-3 pb-4 text-left align-bottom font-normal">
                  <div className="relative aspect-square w-20 overflow-hidden rounded-lg bg-neutral-100">
                    {p.images[0] && (
                      <Image
                        src={p.images[0].url}
                        alt=""
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    )}
                  </div>
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
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-border-subtle">
            <th scope="row" className="sticky left-0 z-10 bg-background py-3 pr-3 text-left font-medium text-neutral-500">
              From
            </th>
            {columns.map((p) => (
              <td key={p.handle} className="px-3 py-3">
                {formatPrice(p.priceRange.minVariantPrice.amount, p.priceRange.minVariantPrice.currencyCode)}
              </td>
            ))}
          </tr>
          {optionNames.map((name) => (
            <tr key={name} className="border-t border-border-subtle">
              <th scope="row" className="sticky left-0 z-10 bg-background py-3 pr-3 text-left font-medium text-neutral-500">
                {name}
              </th>
              {columns.map((p) => {
                const values = p.options.find((o) => o.name === name)?.values;
                return (
                  <td key={p.handle} className="px-3 py-3 text-neutral-600">
                    {values && values.length > 0 ? values.join(", ") : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
          {specKeys.map((key) => (
            <tr key={key} className="border-t border-border-subtle">
              <th scope="row" className="sticky left-0 z-10 bg-background py-3 pr-3 text-left font-medium text-neutral-500">
                {SPEC_LABELS[key] ?? key}
              </th>
              {columns.map((p) => (
                <td key={p.handle} className="px-3 py-3 text-neutral-600">
                  {specsByHandle.get(p.handle)?.get(key) ?? "—"}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t border-border-subtle">
            <th scope="row" className="sticky left-0 z-10 bg-background py-3 pr-3 text-left font-medium text-neutral-500">
              Availability
            </th>
            {columns.map((p) => (
              <td key={p.handle} className={`px-3 py-3 ${p.availableForSale ? "" : "text-neutral-400"}`}>
                {p.availableForSale ? "In stock" : "Sold out"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
