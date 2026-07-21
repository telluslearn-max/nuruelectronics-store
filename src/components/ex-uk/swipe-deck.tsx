"use client";

import { useRef, useState } from "react";
import { ConciergePanel } from "@/components/concierge/concierge-panel";
import { WhatsAppOrderButton } from "@/components/whatsapp-order-button";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/shopify/types";
import { ExUkProductCard } from "./ex-uk-product-card";
import { MatchesTray } from "./matches-tray";
import { SwipeCard, type SwipeCardHandle } from "./swipe-card";
import { type ExUkMatch, useExUkMatches } from "./use-ex-uk-matches";

function buildInitialMessage(product: Product): string {
  return `Tell me more about the ${product.title} — I'm interested in the Ex-UK (unboxed, 1-year warranty) unit.`;
}

export function SwipeDeck({ products }: { products: Product[] }) {
  const [index, setIndex] = useState(0);
  const [chatProduct, setChatProduct] = useState<Product | null>(null);
  const { matches, addMatch } = useExUkMatches();
  const topCardRef = useRef<SwipeCardHandle>(null);

  const current = products[index];
  const peekCards = products.slice(index + 1, index + 3);

  function handleSwiped(direction: "left" | "right") {
    if (direction === "right" && current) {
      addMatch({ handle: current.handle, title: current.title, imageUrl: current.images[0]?.url ?? null });
      setChatProduct(current);
    }
    setIndex((i) => i + 1);
  }

  function openChatForMatch(match: ExUkMatch) {
    const product = products.find((p) => p.handle === match.handle);
    if (product) setChatProduct(product);
  }

  return (
    <>
      <div className="mx-auto flex max-w-sm flex-col items-center px-4 pb-24 pt-8">
        <div className="relative aspect-[4/5] w-full">
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
                <ExUkProductCard product={product} />
              </div>
            ))}

          {current ? (
            <SwipeCard key={current.id} ref={topCardRef} product={current} onSwiped={handleSwiped} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border-subtle p-8 text-center">
              <p className="text-base font-medium">That&apos;s every Ex-UK unit for now</p>
              <p className="text-sm text-neutral-500">Check your matches below, or check back soon for new stock.</p>
            </div>
          )}
        </div>

        {current && (
          <div className="mt-6 flex items-center justify-center gap-6">
            <button
              type="button"
              aria-label={`Pass on ${current.title}`}
              onClick={() => topCardRef.current?.swipe("left")}
              className="flex h-14 w-14 items-center justify-center rounded-control border border-border-subtle text-2xl text-neutral-500 transition hover:border-neutral-400"
            >
              ✕
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
              className="flex h-14 w-14 items-center justify-center rounded-control bg-accent text-2xl text-accent-foreground transition hover:opacity-90"
            >
              ♥
            </button>
          </div>
        )}
      </div>

      <MatchesTray matches={matches} onSelect={openChatForMatch} />

      {chatProduct && (
        <ConciergePanel
          key={chatProduct.handle}
          initialMessage={buildInitialMessage(chatProduct)}
          onClose={() => setChatProduct(null)}
        />
      )}
    </>
  );
}
