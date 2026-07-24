import Image from "next/image";
import { formatPrice } from "@/lib/format";
import { SPEC_LABELS } from "@/components/product-specs";
import type { Product } from "@/lib/shopify/types";

// SPEC_LABELS is grouped by category in declaration order (compute, display,
// audio, power, connectivity, physical, appliances) — reuse that order so
// comparison rows read in the same sensible sequence as the PDP's own
// Specifications section.
const SPEC_KEY_ORDER = Object.keys(SPEC_LABELS);

/**
 * Shared spec-comparison table: rows are built from real product data only —
 * price, each product's own option axes (Storage, Color, ...), spec
 * metafields, and availability — nothing fabricated. Price and availability
 * always show. Option and spec rows are held to a stricter bar: a row only
 * appears if EVERY compared product actually has that field set (no "—"
 * filler for products that simply don't have it) AND the values aren't
 * identical across all of them — comparing across dissimilar products
 * otherwise buries the few relevant rows in irrelevant/blank ones.
 * `renderColumnHeader` lets callers customize the per-column header area
 * (e.g. a "Viewing" badge vs. Remove/Add-to-cart buttons) while sharing the
 * rest of the table.
 */
export function CompareTable({
  columns,
  renderColumnHeader,
}: {
  columns: Product[];
  renderColumnHeader: (product: Product, index: number) => React.ReactNode;
}) {
  // "Title" is Shopify's auto-assigned option name for products with no real
  // customer-facing options (single "Default Title" variant) — not a useful
  // comparison row, so it's excluded.
  const optionNames = Array.from(
    new Set(columns.flatMap((p) => p.options.map((o) => o.name))),
  )
    .filter((name) => name !== "Title")
    .filter((name) => columns.every((p) => p.options.some((o) => o.name === name)))
    .filter((name) => {
      const values = columns.map(
        (p) => p.options.find((o) => o.name === name)?.values.join(", ") ?? "",
      );
      return new Set(values).size > 1;
    });

  const specsByHandle = new Map(
    columns.map((p) => [p.handle, new Map((p.specs ?? []).map((s) => [s.key, s.value]))]),
  );
  const specKeys = SPEC_KEY_ORDER.filter((key) =>
    columns.every((p) => specsByHandle.get(p.handle)?.has(key)),
  ).filter((key) => {
    const values = columns.map((p) => specsByHandle.get(p.handle)?.get(key));
    return new Set(values).size > 1;
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 w-32 bg-background" />
            {columns.map((p, index) => (
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
                {renderColumnHeader(p, index)}
              </th>
            ))}
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
      {optionNames.length === 0 && specKeys.length === 0 && (
        <p className="mt-4 text-sm text-neutral-500">
          These products don&apos;t share any comparable option or spec fields — try comparing
          items from the same category for a more detailed breakdown.
        </p>
      )}
    </div>
  );
}
