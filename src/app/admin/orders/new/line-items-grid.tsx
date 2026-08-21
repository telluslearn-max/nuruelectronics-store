"use client";

import { useRef, useState } from "react";
import { inputClass } from "../[id]/_shared";
import { formatPrice } from "@/lib/format";

// Matches parseLineItems' actual cap in admin-actions.ts (`for (let i = 0; i < 20; i++)`).
const MAX_LINE_ITEMS = 20;

type Row = { id: number; title: string; qty: string; price: string; variantId: string };

function emptyRow(id: number): Row {
  return { id, title: "", qty: "1", price: "", variantId: "" };
}

function lineTotal(row: Row): number {
  const qty = Number(row.qty) || 0;
  const price = Number(row.price) || 0;
  return qty * price;
}

function LineItemRow({
  row,
  index,
  onChange,
  onRemove,
  removable,
}: {
  row: Row;
  index: number;
  onChange: (patch: Partial<Row>) => void;
  onRemove: () => void;
  removable: boolean;
}) {
  return (
    <div className="rounded-control border border-border-subtle p-3">
      <div className="flex items-start gap-2">
        <input
          name={`item_title_${index}`}
          type="text"
          placeholder="Product / description"
          value={row.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className={`flex-1 ${inputClass}`}
        />
        <button
          type="button"
          onClick={onRemove}
          disabled={!removable}
          aria-label="Remove line item"
          title="Remove line item"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control border border-border-subtle text-neutral-500 transition hover:border-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
        >
          &times;
        </button>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-neutral-500">Qty</label>
          <input
            name={`item_qty_${index}`}
            type="number"
            min={0}
            step={1}
            value={row.qty}
            onChange={(e) => onChange({ qty: e.target.value })}
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500">Unit price (KES)</label>
          <input
            name={`item_price_${index}`}
            type="number"
            min={0}
            step="0.01"
            value={row.price}
            onChange={(e) => onChange({ price: e.target.value })}
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500">Line total</label>
          <p className="mt-1 flex h-[38px] items-center px-1 text-sm font-medium">
            {formatPrice(String(lineTotal(row)), "KES")}
          </p>
        </div>
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-neutral-500 select-none">
          Shopify Variant ID (optional)
        </summary>
        <input
          name={`item_variant_${index}`}
          type="text"
          placeholder="gid://shopify/ProductVariant/…"
          value={row.variantId}
          onChange={(e) => onChange({ variantId: e.target.value })}
          className={`mt-2 ${inputClass}`}
        />
      </details>
    </div>
  );
}

export function LineItemsGrid() {
  const nextId = useRef(1);
  const [rows, setRows] = useState<Row[]>(() => [emptyRow(0)]);

  const subtotal = rows.reduce((sum, row) => sum + lineTotal(row), 0);

  function addRow() {
    setRows((current) => (current.length >= MAX_LINE_ITEMS ? current : [...current, emptyRow(nextId.current++)]));
  }

  function removeRow(id: number) {
    setRows((current) => (current.length <= 1 ? current : current.filter((row) => row.id !== id)));
  }

  function updateRow(id: number, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  return (
    <div className="mt-2 space-y-2">
      {rows.map((row, index) => (
        <LineItemRow
          key={row.id}
          row={row}
          index={index}
          onChange={(patch) => updateRow(row.id, patch)}
          onRemove={() => removeRow(row.id)}
          removable={rows.length > 1}
        />
      ))}

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={addRow}
          disabled={rows.length >= MAX_LINE_ITEMS}
          className="text-sm font-medium text-accent transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          + Add line item ({rows.length}/{MAX_LINE_ITEMS})
        </button>
        <p className="text-sm">
          <span className="text-neutral-500">Subtotal </span>
          <span className="font-medium">{formatPrice(String(subtotal), "KES")}</span>
        </p>
      </div>
    </div>
  );
}
