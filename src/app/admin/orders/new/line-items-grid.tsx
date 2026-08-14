"use client";

import { useState } from "react";
import { inputClass } from "../[id]/_shared";
import { computeLineMargin, computeOrderMargin } from "@/lib/margin";

// Matches parseLineItems' actual cap in admin-actions.ts (`for (let i = 0; i < 20; i++)`) — the
// form used to stop at 8 static rows with no way to reach the other 12 the server already accepts.
const MAX_LINE_ITEMS = 20;
const INITIAL_ROWS = 8;
const ROWS_PER_ADD = 4;

type RowState = { qty: string; price: string; cost: string };

const EMPTY_ROW: RowState = { qty: "", price: "", cost: "" };

function formatKes(amount: number): string {
  return amount.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}

function formatPercent(percent: number | null): string {
  if (percent == null) return "—";
  return `${percent >= 0 ? "" : "−"}${Math.abs(percent).toFixed(1)}%`;
}

function LineItemRow({
  index,
  row,
  onChange,
}: {
  index: number;
  row: RowState;
  onChange: (index: number, field: keyof RowState, value: string) => void;
}) {
  const qty = Number(row.qty) || 0;
  const price = Number(row.price) || 0;
  const cost = row.cost.trim() === "" ? null : Number(row.cost) || 0;
  const { marginAmount, marginPercent } = computeLineMargin({ unitPrice: price, unitCost: cost, quantity: qty });
  const hasMarginData = cost != null && qty > 0 && price > 0;

  return (
    <div className="rounded-control border border-border-subtle p-3">
      <input
        name={`item_title_${index}`}
        type="text"
        placeholder="Product / description"
        className={inputClass}
      />
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <label className="block text-[11px] text-neutral-500">Qty</label>
          <input
            name={`item_qty_${index}`}
            type="number"
            min={0}
            step={1}
            value={row.qty}
            onChange={(e) => onChange(index, "qty", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-[11px] text-neutral-500">Sell price (KES)</label>
          <input
            name={`item_price_${index}`}
            type="number"
            min={0}
            step="0.01"
            value={row.price}
            onChange={(e) => onChange(index, "price", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-[11px] text-neutral-500">Cost price (KES)</label>
          <input
            name={`item_cost_${index}`}
            type="number"
            min={0}
            step="0.01"
            value={row.cost}
            onChange={(e) => onChange(index, "cost", e.target.value)}
            className={inputClass}
            placeholder="optional"
          />
        </div>
        <div>
          <label className="block text-[11px] text-neutral-500">Shopify Variant ID</label>
          <input
            name={`item_variant_${index}`}
            type="text"
            placeholder="gid://shopify/…"
            className={inputClass}
          />
        </div>
      </div>
      {hasMarginData && (
        <p className="mt-2 text-xs text-neutral-500">
          Margin: <span className={marginAmount >= 0 ? "text-green-700" : "text-red-700"}>
            KES {formatKes(marginAmount)} ({formatPercent(marginPercent)})
          </span>
        </p>
      )}
    </div>
  );
}

export function LineItemsGrid() {
  const [rowCount, setRowCount] = useState(INITIAL_ROWS);
  const [rows, setRows] = useState<RowState[]>(() =>
    Array.from({ length: INITIAL_ROWS }, (_, i) => (i === 0 ? { ...EMPTY_ROW, qty: "1" } : { ...EMPTY_ROW })),
  );

  const updateRow = (index: number, field: keyof RowState, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addRows = () => {
    setRowCount((count) => {
      const nextCount = Math.min(MAX_LINE_ITEMS, count + ROWS_PER_ADD);
      setRows((prev) => {
        const next = [...prev];
        while (next.length < nextCount) next.push({ ...EMPTY_ROW });
        return next;
      });
      return nextCount;
    });
  };

  const orderMargin = computeOrderMargin(
    rows.slice(0, rowCount).map((row) => ({
      unitPrice: Number(row.price) || 0,
      unitCost: row.cost.trim() === "" ? null : Number(row.cost) || 0,
      quantity: Number(row.qty) || 0,
    })),
    0,
  );

  return (
    <div className="mt-2 space-y-2">
      {Array.from({ length: rowCount }).map((_, i) => (
        <LineItemRow key={i} index={i} row={rows[i] ?? EMPTY_ROW} onChange={updateRow} />
      ))}
      {rowCount < MAX_LINE_ITEMS && (
        <button
          type="button"
          onClick={addRows}
          className="text-sm font-medium text-accent hover:opacity-80"
        >
          + Add more rows ({rowCount}/{MAX_LINE_ITEMS})
        </button>
      )}
      {orderMargin.hasCostData && (
        <div className="rounded-control border border-border-subtle bg-neutral-50 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Revenue</span>
            <span>KES {formatKes(orderMargin.revenue)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Cost</span>
            <span>KES {formatKes(orderMargin.cost)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between border-t border-border-subtle pt-1 font-medium">
            <span>Margin</span>
            <span className={orderMargin.grossMargin >= 0 ? "text-green-700" : "text-red-700"}>
              KES {formatKes(orderMargin.grossMargin)} ({formatPercent(orderMargin.grossMarginPercent)})
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
