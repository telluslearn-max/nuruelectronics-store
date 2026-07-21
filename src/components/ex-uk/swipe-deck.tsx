"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { WhatsAppOrderButton } from "@/components/whatsapp-order-button";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/shopify/types";
import { ExUkProductCard } from "./ex-uk-product-card";
import { ExUkProductDetail } from "./ex-uk-product-detail";
import { SwipeCard, type SwipeCardHandle } from "./swipe-card";
import { useExUkMatches } from "./use-ex-uk-matches";

export function SwipeDeck({ products }: { products: Product[] }) {
  const [index, setIndex] = useState(0);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const { addMatch } = useExUkMatches();
  const topCardRef = useRef<SwipeCardHandle>(null);
  const router = useRouter();

  const current = products[index];
  const peekCards = products.slice(index + 1, index + 3);

  function handleSwiped(direction: "left" | "right") {
    setDetailProduct(null);
    if (direction === "right" && current) {
      addMatch({ handle: current.handle, title: current.title, imageUrl: current.images[0]?.url ?? null });
      router.push(`/ex-uk/messages/${current.handle}`);
      return;
    }
    setIndex((i) => i + 1);
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
              <ExUkProductCard product={product} />
            </div>
          ))}

        {current ? (
          <SwipeCard
            key={current.id}
            ref={topCardRef}
            product={current}
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
        <div className="flex shrink-0 items-center justify-center gap-6 py-3">
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

      {detailProduct && (
        <ExUkProductDetail product={detailProduct} onClose={() => setDetailProduct(null)} onSwipe={handleSwiped} />
      )}
    </div>
  );
}
