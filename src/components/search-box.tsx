"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { searchSuggestions, type SearchSuggestion } from "@/lib/actions";
import { categoryForProductType, type ArtKind } from "@/lib/categories";
import { formatPrice } from "@/lib/format";
import { ArtGlyph } from "./product-media";

export function SearchBox() {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = term.trim();
    if (trimmed.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const results = await searchSuggestions(trimmed);
      if (cancelled) return;
      setSuggestions(results);
      setIsOpen(results.length > 0);
      setActiveIndex(-1);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setTerm(value);
    if (value.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      setActiveIndex(-1);
    }
  }

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function close() {
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
      close();
      router.push(`/products/${suggestions[activeIndex].handle}`);
    } else if (event.key === "Escape") {
      close();
    }
  }

  return (
    <div ref={containerRef} className="relative flex-1">
      <form action="/search" role="search" onSubmit={close}>
        <input
          type="search"
          name="q"
          value={term}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder="Search products"
          aria-label="Search products"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="search-suggestions"
          aria-activedescendant={activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined}
          autoComplete="off"
          className="w-full rounded-control border border-border-subtle bg-background px-4 py-2 text-sm focus:border-foreground focus:outline-none"
        />
      </form>

      {isOpen && (
        <ul
          id="search-suggestions"
          role="listbox"
          aria-label="Search suggestions"
          className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-card border border-border-subtle bg-background shadow-lg"
        >
          {suggestions.map((suggestion, index) => {
            const art: ArtKind =
              categoryForProductType(suggestion.productType)?.art ?? "generic";
            return (
              <li key={suggestion.handle} role="option" aria-selected={index === activeIndex}>
                <Link
                  href={`/products/${suggestion.handle}`}
                  id={`suggestion-${index}`}
                  onClick={close}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm transition ${
                    index === activeIndex ? "bg-neutral-100" : "hover:bg-neutral-50"
                  }`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
                    <ArtGlyph kind={art} className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{suggestion.title}</span>
                  <span className="shrink-0 text-neutral-500">
                    {formatPrice(suggestion.price.amount, suggestion.price.currencyCode)}
                  </span>
                </Link>
              </li>
            );
          })}
          <li className="border-t border-border-subtle">
            <Link
              href={`/search?q=${encodeURIComponent(term.trim())}`}
              onClick={close}
              className="block px-4 py-2.5 text-sm font-medium text-accent hover:bg-neutral-50"
            >
              See all results for &ldquo;{term.trim()}&rdquo;
            </Link>
          </li>
        </ul>
      )}
    </div>
  );
}
