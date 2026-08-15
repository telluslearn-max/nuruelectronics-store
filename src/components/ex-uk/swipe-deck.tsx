"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { WhatsAppIcon, WhatsAppOrderButton } from "@/components/whatsapp-order-button";
import { formatPrice } from "@/lib/format";
import type { Savings } from "@/lib/product-match";
import type { Product } from "@/lib/shopify/types";
import { WHATSAPP_NUMBER } from "@/lib/whatsapp";
import { HeartIcon, PassIcon } from "./action-icons";
import { ExUkProductCard } from "./ex-uk-product-card";
import { ExUkProductDetail } from "./ex-uk-product-detail";
import { SwipeCard, type SwipeCardHandle } from "./swipe-card";
import { useExUkMatches } from "./use-ex-uk-matches";
import { useExUkSeen } from "./use-ex-uk-seen";

function UndoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 8H12a4 4 0 1 1 0 8H8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 4.5 5 8l3 3.5" />
    </svg>
  );
}

type LastAction = { direction: "left" | "right"; product: Product };

export function SwipeDeck({
  products,
  savingsByHandle = {},
  isFiltered = false,
  onClearFilters,
  highlightHandle,
}: {
  products: Product[];
  savingsByHandle?: Record<string, Savings>;
  /** Whether `products` already reflects an active category/price filter — changes the empty-state copy. */
  isFiltered?: boolean;
  onClearFilters?: () => void;
  /** Handle deep-linked in from elsewhere (e.g. the concierge) — the matching card gets a visual badge. */
  highlightHandle?: string | null;
}) {
  const [index, setIndex] = useState(0);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [justMatched, setJustMatched] = useState<Product | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const { addMatch, removeMatch } = useExUkMatches();
  const { seen, markSeen, unmarkSeen, clearSeen } = useExUkSeen();
  const topCardRef = useRef<SwipeCardHandle>(null);

  // Cards already swiped in a previous visit (either direction) are filtered out here — not by
  // the parent — so `index` keeps walking a single stable, order-preserving array rather than
  // needing to be reconciled against a separately-filtered list.
  const availableProducts = useMemo(() => products.filter((p) => !seen.has(p.handle)), [products, seen]);

  const current = availableProducts[index];
  const peekCards = availableProducts.slice(index + 1, index + 3);

  function handleSwiped(direction: "left" | "right") {
    setDetailProduct(null);
    if (!current) return;
    markSeen(current.handle);
    setLastAction({ direction, product: current });
    if (direction === "right") {
      addMatch({ handle: current.handle, title: current.title, imageUrl: current.images[0]?.url ?? null });
      setJustMatched(current);
      setAnnouncement(`Liked ${current.title}. It's a match!`);
    } else {
      setJustMatched(null);
      setAnnouncement(`Passed on ${current.title}.`);
    }
    setIndex((i) => i + 1);
  }

  function handleUndo() {
    if (!lastAction) return;
    unmarkSeen(lastAction.product.handle);
    if (lastAction.direction === "right") {
      removeMatch(lastAction.product.handle);
      setJustMatched(null);
    }
    setAnnouncement(
      `Undid ${lastAction.direction === "right" ? "match with" : "pass on"} ${lastAction.product.title}.`,
    );
    setLastAction(null);
    setIndex((i) => Math.max(0, i - 1));
  }

  function handleStartOver() {
    clearSeen();
    setIndex(0);
    setLastAction(null);
    setJustMatched(null);
    setAnnouncement("Starting over — every Ex-UK unit is back in the deck.");
  }

  return (
    <div className="flex h-full flex-col px-2 pb-2 pt-2">
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {justMatched && (
        <div className="mb-2 flex shrink-0 items-center justify-between gap-2 rounded-card bg-accent/10 px-3 py-2 text-sm text-accent">
          <span className="truncate">
            It&apos;s a match! You liked <span className="font-medium">{justMatched.title}</span>.
          </span>
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href={`/ex-uk/messages/${justMatched.handle}`}
              className="font-medium underline underline-offset-2"
            >
              View chat
            </Link>
            <button
              type="button"
              aria-label="Dismiss match notice"
              onClick={() => setJustMatched(null)}
              className="text-accent/70 hover:text-accent"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      <div className="relative flex-1">
        {peekCards
          .slice()
          .reverse()
          .map((product, i) => (
            <div
              key={product.id}
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                transform: `translateY(${(peekCards.length - i) * 10}px) scale(${1 - (peekCards.length - i) * 0.04})`,
                opacity: 0.6,
              }}
            >
              <ExUkProductCard product={product} savings={savingsByHandle[product.handle]} />
            </div>
          ))}

        {current ? (
          <SwipeCard
            key={current.id}
            ref={topCardRef}
            product={current}
            savings={savingsByHandle[current.handle]}
            onSwiped={handleSwiped}
            onTap={() => setDetailProduct(current)}
          />
        ) : products.length === 0 && isFiltered ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border-subtle p-8 text-center">
            <p className="text-base font-medium">No units match your filters</p>
            <p className="text-sm text-neutral-500">Try a different category or price range.</p>
            {onClearFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                className="mt-2 rounded-control border border-border-subtle px-4 py-2 text-sm font-medium transition hover:border-foreground"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border-subtle p-8 text-center">
            <p className="text-base font-medium">That&apos;s every Ex-UK unit for now</p>
            <p className="text-sm text-neutral-500">
              {products.length > 0
                ? "You've swiped through all of them. Start over to see them again, or check back soon for new stock."
                : "Check your matches in Messages, or check back soon for new stock."}
            </p>
            {products.length > 0 && (
              <button
                type="button"
                onClick={handleStartOver}
                className="mt-2 rounded-control border border-border-subtle px-4 py-2 text-sm font-medium transition hover:border-foreground"
              >
                Start over
              </button>
            )}
          </div>
        )}

        {current && highlightHandle && current.handle === highlightHandle && (
          <span className="absolute left-3 top-3 z-20 rounded-control bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground shadow-sm">
            Recommended for you
          </span>
        )}
      </div>

      {current && (
        <div className="flex shrink-0 items-center justify-center gap-4 py-3">
          <button
            type="button"
            aria-label="Undo last swipe"
            onClick={handleUndo}
            disabled={!lastAction}
            className="flex h-11 w-11 items-center justify-center rounded-control border border-border-subtle text-neutral-500 transition hover:border-neutral-400 disabled:opacity-30"
          >
            <UndoIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label={`Pass on ${current.title}`}
            onClick={() => topCardRef.current?.swipe("left")}
            className="flex h-14 w-14 items-center justify-center rounded-control border border-border-subtle text-neutral-500 shadow-sm transition hover:border-neutral-400 hover:text-neutral-700"
          >
            <PassIcon className="h-6 w-6" />
          </button>
          {WHATSAPP_NUMBER ? (
            <WhatsAppOrderButton
              productTitle={current.title}
              price={formatPrice(current.priceRange.minVariantPrice.amount, current.priceRange.minVariantPrice.currencyCode)}
              productHandle={current.handle}
              compact
            />
          ) : (
            <span
              aria-hidden="true"
              title="WhatsApp ordering isn't set up yet"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-dashed border-border-subtle text-neutral-300"
            >
              <WhatsAppIcon className="h-5 w-5" />
            </span>
          )}
          <button
            type="button"
            aria-label={`Love ${current.title}`}
            onClick={() => topCardRef.current?.swipe("right")}
            className="flex h-14 w-14 items-center justify-center rounded-control bg-accent text-accent-foreground shadow-md transition hover:opacity-90"
          >
            <HeartIcon className="h-7 w-7 drop-shadow-sm" />
          </button>
        </div>
      )}

      {detailProduct && (
        <ExUkProductDetail
          product={detailProduct}
          savings={savingsByHandle[detailProduct.handle]}
          onClose={() => setDetailProduct(null)}
          onSwipe={handleSwiped}
        />
      )}
    </div>
  );
}
