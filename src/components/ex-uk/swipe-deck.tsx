"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { WhatsAppOrderButton } from "@/components/whatsapp-order-button";
import { formatPrice } from "@/lib/format";
import type { Savings } from "@/lib/product-match";
import type { Product } from "@/lib/shopify/types";
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

export function SwipeDeck({
  products,
  savingsByHandle = {},
}: {
  products: Product[];
  savingsByHandle?: Record<string, Savings>;
}) {
  const [index, setIndex] = useState(0);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [lastPassed, setLastPassed] = useState<Product | null>(null);
  const { addMatch } = useExUkMatches();
  const { seen, markSeen, unmarkSeen } = useExUkSeen();
  const topCardRef = useRef<SwipeCardHandle>(null);
  const router = useRouter();

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
    if (direction === "right") {
      addMatch({ handle: current.handle, title: current.title, imageUrl: current.images[0]?.url ?? null });
      router.push(`/ex-uk/messages/${current.handle}`);
      return;
    }
    setLastPassed(current);
    setIndex((i) => i + 1);
  }

  function handleUndo() {
    if (!lastPassed) return;
    unmarkSeen(lastPassed.handle);
    setLastPassed(null);
    setIndex((i) => Math.max(0, i - 1));
  }

  return (
    <div className="flex h-full flex-col px-2 pb-2 pt-2">
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
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border-subtle p-8 text-center">
            <p className="text-base font-medium">That&apos;s every Ex-UK unit for now</p>
            <p className="text-sm text-neutral-500">Check your matches in Messages, or check back soon for new stock.</p>
          </div>
        )}
      </div>

      {current && (
        <div className="flex shrink-0 items-center justify-center gap-4 py-3">
          <button
            type="button"
            aria-label="Undo last pass"
            onClick={handleUndo}
            disabled={!lastPassed}
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
          <WhatsAppOrderButton
            productTitle={current.title}
            price={formatPrice(current.priceRange.minVariantPrice.amount, current.priceRange.minVariantPrice.currencyCode)}
            productHandle={current.handle}
            compact
          />
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
