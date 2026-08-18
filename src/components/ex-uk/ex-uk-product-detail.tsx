"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ColorSwatches } from "@/components/color-swatches";
import { useCart } from "@/components/cart/cart-context";
import { ProductMedia } from "@/components/product-media";
import { useFocusTrap } from "@/components/use-focus-trap";
import { useHorizontalWheelPassthrough } from "@/components/use-horizontal-wheel-passthrough";
import { WhatsAppOrderButton } from "@/components/whatsapp-order-button";
import { addItem } from "@/lib/actions";
import { isCheckoutUsable } from "@/lib/checkout";
import { formatPrice } from "@/lib/format";
import type { Savings } from "@/lib/product-match";
import type { Product, ProductVariant } from "@/lib/shopify/types";
import { WHATSAPP_NUMBER } from "@/lib/whatsapp";
import { BookmarkIcon } from "./action-icons";
import { gradeForProduct } from "./condition-grade";
import { BagIcon, BoxIcon, ConditionChipIconGlyph, CoinIcon, ShieldIcon } from "./detail-icons";
import { InspectionAccordion } from "./inspection-accordion";
import { sortSpecs } from "./spec-order";
import { useExUkBookmark } from "./use-ex-uk-bookmark";

function BackIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12.5 4 6 10l6.5 6" />
    </svg>
  );
}

/** No variant picker in this compact overlay — same "start cheapest available" rule as the real
 * PDP's ProductOptions (src/components/product-options.tsx), just without letting a shopper
 * change it here; they can still pick a different condition/storage via the full PDP if needed. */
function defaultVariant(variants: ProductVariant[]): ProductVariant | undefined {
  const byPrice = (a: ProductVariant, b: ProductVariant) => Number(a.price.amount) - Number(b.price.amount);
  const available = variants.filter((v) => v.availableForSale).sort(byPrice);
  return available[0] ?? [...variants].sort(byPrice)[0];
}

/**
 * Full-detail overlay opened by tapping a card, within the same Ex-UK shell (no site chrome) —
 * shows everything the teaser card truncates: every photo, the full spec list, and the full
 * description. The back/bookmark buttons float directly over the hero photo (no header strip);
 * bookmark saves to the real wishlist (useExUkBookmark). The bottom bar is real commerce — Add to
 * Cart and Buy Now both mutate the same Shopify cart the rest of the site uses (src/lib/actions.ts)
 * — with a WhatsApp fallback if checkout isn't configured (mirrors ProductOptions' buyNow()).
 */
export function ExUkProductDetail({
  product,
  savings,
  onClose,
}: {
  product: Product;
  savings?: Savings | null;
  onClose: () => void;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(true);
  const handleThumbnailWheel = useHorizontalWheelPassthrough<HTMLDivElement>();
  const image = product.images[photoIndex] ?? product.images[0];
  const price = product.priceRange.minVariantPrice;
  const specs = sortSpecs(product.specs);
  const grade = gradeForProduct(product.tags);
  const colorOption = product.options.find((o) => /^colou?r$/i.test(o.name));
  const variant = defaultVariant(product.variants);
  const { isBookmarked, toggleBookmark } = useExUkBookmark();
  const bookmarked = isBookmarked(product.handle);

  const { setCart } = useCart();
  const [isAdding, startAdding] = useTransition();
  const [addedMessage, setAddedMessage] = useState<string | null>(null);
  const [isBuyingNow, startBuyNow] = useTransition();
  const [buyNowError, setBuyNowError] = useState<string | null>(null);

  useEffect(() => {
    if (!addedMessage) return;
    const timer = setTimeout(() => setAddedMessage(null), 1800);
    return () => clearTimeout(timer);
  }, [addedMessage]);

  useEffect(() => {
    closeButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleAddToCart() {
    if (!variant) return;
    startAdding(async () => {
      try {
        const cart = await addItem(variant.id, 1);
        setCart(cart);
        setAddedMessage("Added to cart");
      } catch {
        setAddedMessage("Couldn't add — try again");
      }
    });
  }

  function handleBuyNow() {
    if (!variant) return;
    setBuyNowError(null);
    startBuyNow(async () => {
      try {
        const cart = await addItem(variant.id, 1);
        setCart(cart);
        if (!isCheckoutUsable(cart.checkoutUrl)) {
          setBuyNowError("Checkout isn't available right now — order via WhatsApp below instead.");
          return;
        }
        window.location.href = cart.checkoutUrl;
      } catch {
        setBuyNowError("Couldn't start checkout — order via WhatsApp below instead.");
      }
    });
  }

  return (
    <div
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${product.title} details`}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      <div className="flex-1 overflow-y-auto">
        <div className="relative aspect-square w-full bg-neutral-100">
          <ProductMedia image={image} title={product.title} productType={product.productType} sizes="100vw" priority />

          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close details"
            className="absolute left-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70"
          >
            <BackIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => toggleBookmark(product)}
            aria-pressed={bookmarked}
            aria-label={bookmarked ? `Remove ${product.title} from wishlist` : `Save ${product.title} to wishlist`}
            className={`absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full shadow-sm transition ${
              bookmarked ? "bg-accent text-accent-foreground" : "bg-white/90 text-neutral-900 hover:bg-white"
            }`}
          >
            <BookmarkIcon className="h-4 w-4" filled={bookmarked} />
          </button>
        </div>

        {product.images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto overscroll-x-contain p-3" onWheel={handleThumbnailWheel}>
            {product.images.map((img, i) => (
              <button
                key={img.url + i}
                type="button"
                aria-label={`Show photo ${i + 1} of ${product.images.length}`}
                aria-current={i === photoIndex}
                onClick={() => setPhotoIndex(i)}
                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-control border-2 ${
                  i === photoIndex ? "border-accent" : "border-transparent"
                }`}
              >
                <ProductMedia image={img} title={product.title} sizes="64px" />
              </button>
            ))}
          </div>
        )}

        <div className="px-4 pb-6">
          <div className="flex items-start justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-xl font-bold leading-snug">
              {product.title}
              <svg
                viewBox="0 0 20 20"
                className="h-4 w-4 shrink-0 text-accent"
                fill="currentColor"
                aria-label="Tested & verified"
              >
                <title>Tested &amp; verified</title>
                <path d="M10 1.5 12.4 4l3.4-.6.6 3.4 2.5 2.4-2.5 2.4-.6 3.4-3.4-.6L10 17l-2.4-2.6-3.4.6-.6-3.4L1.1 9.2l2.5-2.4.6-3.4L7.6 4 10 1.5Z" />
                <path
                  d="M6.8 9.4l2 2 4.2-4.4"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </h2>
            <p className="shrink-0 text-xl font-bold">{formatPrice(price.amount, price.currencyCode)}</p>
          </div>

          {colorOption && <ColorSwatches values={colorOption.values} />}

          <div className="mt-2 space-y-1.5 text-sm text-neutral-600">
            <p className="flex items-center gap-1.5">
              <BoxIcon className="h-4 w-4 shrink-0 text-neutral-400" />
              Unboxed · imported from the UK
            </p>
            <p className="flex items-center gap-1.5">
              <ShieldIcon className="h-4 w-4 shrink-0 text-neutral-400" />
              1-year warranty included
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-control px-3 py-1.5 text-sm font-medium ${
                grade ? grade.badgeClass : "bg-accent/10 text-accent"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${grade ? grade.dotClass : "bg-accent"}`} aria-hidden="true" />
              {grade ? `${grade.label} — ${grade.description}` : "Condition: Fully tested & unboxed"}
            </span>
            {savings && (
              <span className="inline-flex items-center gap-1.5 rounded-control bg-green-600/10 px-3 py-1.5 text-sm font-medium text-green-700">
                <CoinIcon className="h-4 w-4 shrink-0" />
                Save {formatPrice(savings.amount, savings.currencyCode)} ({savings.percent}%) vs new
              </span>
            )}
          </div>

          {grade && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {grade.chips.map((chip) => (
                <span
                  key={chip.label}
                  className="inline-flex items-center gap-1 rounded-control border border-border-subtle px-2 py-1 text-xs text-neutral-600"
                >
                  <ConditionChipIconGlyph icon={chip.icon} className="h-3.5 w-3.5 shrink-0" />
                  {chip.label}
                </span>
              ))}
            </div>
          )}

          {specs.length > 0 && (
            <div className="mt-5 border-t border-border-subtle pt-4">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Specs</h3>
              <div className="flex flex-wrap gap-2">
                {specs.map((spec) => (
                  <span
                    key={spec.key}
                    className="rounded-control border border-border-subtle px-2.5 py-1 text-sm text-neutral-600"
                  >
                    {spec.value}
                  </span>
                ))}
              </div>
            </div>
          )}

          <InspectionAccordion />

          <div className="mt-5 border-t border-border-subtle pt-4">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">About this unit</h3>
            {/* descriptionHtml (not the plain-text description) so paragraphs/bullet lists the
                merchant actually entered in Shopify survive, matching the real PDP's rendering
                (src/app/(storefront)/products/[handle]/page.tsx) instead of collapsing them into
                one run-on line. */}
            <div
              className="rounded-3xl bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-700 [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_li]:mb-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
            />
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-border-subtle p-4">
        <div className="flex items-center gap-3">
          <span className="relative">
            <button
              type="button"
              aria-label={`Add ${product.title} to cart`}
              onClick={handleAddToCart}
              disabled={!variant?.availableForSale || isAdding}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-control border border-border-subtle text-neutral-500 shadow-sm transition hover:border-neutral-400 hover:text-neutral-700 disabled:opacity-40"
            >
              <BagIcon className="h-6 w-6" />
            </button>
            {addedMessage && (
              <span
                role="status"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-control bg-foreground px-2.5 py-1 text-xs text-background shadow-md"
              >
                {addedMessage}
              </span>
            )}
          </span>
          <button
            type="button"
            disabled={!variant?.availableForSale || isBuyingNow}
            onClick={handleBuyNow}
            className="flex h-14 flex-1 items-center justify-center rounded-control bg-white px-6 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-40"
          >
            {isBuyingNow ? "Redirecting…" : variant?.availableForSale ? "Buy Now" : "Out of stock"}
          </button>
        </div>
        {buyNowError && (
          <div className="mt-3">
            <p role="alert" className="mb-2 text-xs text-red-400">
              {buyNowError}
            </p>
            {WHATSAPP_NUMBER && (
              <WhatsAppOrderButton
                productTitle={product.title}
                price={formatPrice(price.amount, price.currencyCode)}
                productHandle={product.handle}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
