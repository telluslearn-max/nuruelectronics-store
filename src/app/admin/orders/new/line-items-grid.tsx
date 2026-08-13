"use client";

import { useEffect, useRef, useState } from "react";
import { searchProductVariantsForOrder, type OrderVariantSuggestion } from "@/lib/admin-actions";
import { formatPrice } from "@/lib/format";
import { cardClass, inputClass } from "../[id]/_shared";

// Matches parseLineItems' actual cap in admin-actions.ts (`for (let i = 0; i < 20; i++)`) — indices
// must stay within [0, 20) since that's the range the server actually reads by field name.
const MAX_LINE_ITEMS = 20;
const INITIAL_ROWS = 8;
const ROWS_PER_ADD = 4;

/** Debounced product/variant search on the Title field — selecting a result fills in title, price,
 * and the Shopify variant ID for this row. Free typing still works for items not in the catalog
 * (a custom charge, an unlisted deal); the picker is a shortcut, not a requirement. */
function VariantAutocomplete({
  index,
  title,
  onChangeTitle,
  onSelect,
}: {
  index: number;
  title: string;
  onChangeTitle: (value: string) => void;
  onSelect: (suggestion: OrderVariantSuggestion) => void;
}) {
  const [suggestions, setSuggestions] = useState<OrderVariantSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = title.trim();
    if (trimmed.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const results = await searchProductVariantsForOrder(trimmed);
        if (cancelled) return;
        setSuggestions(results);
        setIsOpen(results.length > 0);
        setActiveIndex(-1);
      } catch (error) {
        console.error("Failed to load product suggestions:", error);
        if (cancelled) return;
        setSuggestions([]);
        setIsOpen(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [title]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function pick(suggestion: OrderVariantSuggestion) {
    onSelect(suggestion);
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      pick(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={`item_title_${index}`} className="block text-xs font-medium text-neutral-500">
        Product / description
      </label>
      <input
        id={`item_title_${index}`}
        name={`item_title_${index}`}
        type="text"
        value={title}
        onChange={(e) => {
          const value = e.target.value;
          onChangeTitle(value);
          if (value.trim().length < 2) {
            setSuggestions([]);
            setIsOpen(false);
          }
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setIsOpen(true)}
        placeholder="Search a product, or type your own description"
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={`item_suggestions_${index}`}
        className={`mt-1 ${inputClass}`}
      />
      {isOpen && (
        <ul
          id={`item_suggestions_${index}`}
          role="listbox"
          aria-label="Matching products"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-card border border-border-subtle bg-background shadow-lg"
        >
          {suggestions.map((suggestion, i) => (
            <li key={suggestion.variantId} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                onClick={() => pick(suggestion)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition ${
                  i === activeIndex ? "bg-neutral-100" : "hover:bg-neutral-50"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{suggestion.title}</span>
                <span className="shrink-0 text-neutral-500">
                  {formatPrice(suggestion.price, suggestion.currencyCode)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LineItemRow({
  index,
  displayNumber,
  onRemove,
}: {
  index: number;
  displayNumber: number;
  onRemove: () => void;
}) {
  const [title, setTitle] = useState("");
  const priceRef = useRef<HTMLInputElement>(null);
  const variantRef = useRef<HTMLInputElement>(null);

  function handleSelect(suggestion: OrderVariantSuggestion) {
    setTitle(suggestion.title);
    if (priceRef.current) priceRef.current.value = suggestion.price;
    if (variantRef.current) variantRef.current.value = suggestion.variantId;
  }

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Item {displayNumber}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove item ${displayNumber}`}
          className="text-xs font-medium text-neutral-400 hover:text-red-600"
        >
          Remove
        </button>
      </div>

      <div className="mt-2">
        <VariantAutocomplete index={index} title={title} onChangeTitle={setTitle} onSelect={handleSelect} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor={`item_qty_${index}`} className="block text-xs font-medium text-neutral-500">
            Qty
          </label>
          <input
            id={`item_qty_${index}`}
            name={`item_qty_${index}`}
            type="number"
            min={0}
            step={1}
            defaultValue={index === 0 ? 1 : undefined}
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label htmlFor={`item_price_${index}`} className="block text-xs font-medium text-neutral-500">
            Unit price (KES)
          </label>
          <input
            id={`item_price_${index}`}
            name={`item_price_${index}`}
            ref={priceRef}
            type="number"
            min={0}
            step="0.01"
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor={`item_variant_${index}`} className="block text-xs font-medium text-neutral-500">
            Shopify Variant ID
          </label>
          <input
            id={`item_variant_${index}`}
            name={`item_variant_${index}`}
            ref={variantRef}
            type="text"
            placeholder="Auto-filled when you pick a product above"
            className={`mt-1 ${inputClass}`}
          />
        </div>
      </div>
    </div>
  );
}

export function LineItemsGrid() {
  const [rowIndices, setRowIndices] = useState<number[]>(Array.from({ length: INITIAL_ROWS }, (_, i) => i));
  // How many of the 20 available field-name slots have ever been allocated — tracked separately
  // from rowIndices (the currently *visible* rows) so a removed row's slot is never reused, and
  // "Add more" always hands out fresh, never-submitted field names.
  const [nextIndex, setNextIndex] = useState(INITIAL_ROWS);

  function addRows() {
    const toAdd = Math.min(ROWS_PER_ADD, MAX_LINE_ITEMS - nextIndex);
    if (toAdd <= 0) return;
    const added = Array.from({ length: toAdd }, (_, i) => nextIndex + i);
    setNextIndex(nextIndex + toAdd);
    setRowIndices((prev) => [...prev, ...added]);
  }

  function removeRow(index: number) {
    setRowIndices((prev) => (prev.length > 1 ? prev.filter((i) => i !== index) : prev));
  }

  return (
    <div className="mt-3 space-y-3">
      {rowIndices.map((index, i) => (
        <LineItemRow key={index} index={index} displayNumber={i + 1} onRemove={() => removeRow(index)} />
      ))}
      {nextIndex < MAX_LINE_ITEMS && (
        <button type="button" onClick={addRows} className="text-sm font-medium text-accent hover:opacity-80">
          + Add more rows ({rowIndices.length}/{MAX_LINE_ITEMS})
        </button>
      )}
    </div>
  );
}
