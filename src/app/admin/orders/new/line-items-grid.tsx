"use client";

import { useState } from "react";
import { inputClass } from "../[id]/_shared";

// Matches parseLineItems' actual cap in admin-actions.ts (`for (let i = 0; i < 20; i++)`) — the
// form used to stop at 8 static rows with no way to reach the other 12 the server already accepts.
const MAX_LINE_ITEMS = 20;
const INITIAL_ROWS = 8;
const ROWS_PER_ADD = 4;

function LineItemRow({ index }: { index: number }) {
  return (
    <div className="grid grid-cols-12 gap-2">
      <input
        name={`item_title_${index}`}
        type="text"
        placeholder="Product / description"
        className={`col-span-5 ${inputClass}`}
      />
      <input
        name={`item_qty_${index}`}
        type="number"
        min={0}
        step={1}
        defaultValue={index === 0 ? 1 : undefined}
        className={`col-span-2 ${inputClass}`}
      />
      <input name={`item_price_${index}`} type="number" min={0} step="0.01" className={`col-span-2 ${inputClass}`} />
      <input
        name={`item_variant_${index}`}
        type="text"
        placeholder="gid://shopify/ProductVariant/…"
        className={`col-span-3 ${inputClass}`}
      />
    </div>
  );
}

export function LineItemsGrid() {
  const [rowCount, setRowCount] = useState(INITIAL_ROWS);

  return (
    <div className="mt-2 space-y-2">
      <div className="grid grid-cols-12 gap-2 text-xs text-neutral-500">
        <span className="col-span-5">Title</span>
        <span className="col-span-2">Qty</span>
        <span className="col-span-2">Unit price (KES)</span>
        <span className="col-span-3">Shopify Variant ID</span>
      </div>
      {Array.from({ length: rowCount }).map((_, i) => (
        <LineItemRow key={i} index={i} />
      ))}
      {rowCount < MAX_LINE_ITEMS && (
        <button
          type="button"
          onClick={() => setRowCount((count) => Math.min(MAX_LINE_ITEMS, count + ROWS_PER_ADD))}
          className="text-sm font-medium text-accent hover:opacity-80"
        >
          + Add more rows ({rowCount}/{MAX_LINE_ITEMS})
        </button>
      )}
    </div>
  );
}
