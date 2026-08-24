"use client";

import { useRef, useState } from "react";
import { inputClass } from "../[id]/_shared";
import { formatPrice } from "@/lib/format";

// Matches parseLineItems' actual cap in admin-actions.ts (`for (let i = 0; i < 20; i++)`).
const MAX_LINE_ITEMS = 20;

type Row = { id: number; title: string; description: string; qty: string; price: string; discount: string; variantId: string };

function emptyRow(id: number): Row {
  return { id, title: "", description: "", qty: "1", price: "", discount: "", variantId: "" };
}

function lineTotal(row: Row): number {
  const qty = Number(row.qty) || 0;
  const price = Number(row.price) || 0;
  const discount = Number(row.discount) || 0;
  return Math.max(0, qty * price - discount);
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m2 0-.6 9.6a1.5 1.5 0 0 1-1.5 1.4H8.1a1.5 1.5 0 0 1-1.5-1.4L6 6" />
    </svg>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-neutral-500">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
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
    <div className="rounded-card border border-border-subtle bg-neutral-50 p-3">
      <div className="flex items-start gap-2">
        <span className="mt-2.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[11px] font-medium text-neutral-600">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <input
            name={`item_title_${index}`}
            type="text"
            placeholder="Product / description"
            value={row.title}
            onChange={(e) => onChange({ title: e.target.value })}
            className={inputClass}
          />
          <input
            name={`item_description_${index}`}
            type="text"
            placeholder="Serial number, condition, notes… (optional)"
            value={row.description}
            onChange={(e) => onChange({ description: e.target.value })}
            className={`${inputClass} text-xs`}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={!removable}
          aria-label="Remove line item"
          title="Remove line item"
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-neutral-400 transition hover:bg-neutral-200 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <TrashIcon />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Qty">
          <input
            name={`item_qty_${index}`}
            type="number"
            min={0}
            step={1}
            value={row.qty}
            onChange={(e) => onChange({ qty: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Unit price (KES)">
          <input
            name={`item_price_${index}`}
            type="number"
            min={0}
            step="0.01"
            value={row.price}
            onChange={(e) => onChange({ price: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Discount (KES)">
          <input
            name={`item_discount_${index}`}
            type="number"
            min={0}
            step="0.01"
            placeholder="0"
            value={row.discount}
            onChange={(e) => onChange({ discount: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Line total">
          <p className="flex h-[38px] items-center text-sm font-medium">{formatPrice(String(lineTotal(row)), "KES")}</p>
        </Field>
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

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
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
