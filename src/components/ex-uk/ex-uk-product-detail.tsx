"use client";

import { useEffect, useRef, useState } from "react";
import { ProductMedia } from "@/components/product-media";
import { useFocusTrap } from "@/components/use-focus-trap";
import { useHorizontalWheelPassthrough } from "@/components/use-horizontal-wheel-passthrough";
import { WhatsAppIcon, WhatsAppOrderButton } from "@/components/whatsapp-order-button";
import { formatPrice } from "@/lib/format";
import type { Savings } from "@/lib/product-match";
import type { Product } from "@/lib/shopify/types";
import { WHATSAPP_NUMBER } from "@/lib/whatsapp";
import { HeartIcon, PassIcon } from "./action-icons";
import { gradeForProduct } from "./condition-grade";
import { BoxIcon, ConditionChipIconGlyph, CoinIcon, ShieldIcon } from "./detail-icons";
import { InspectionAccordion } from "./inspection-accordion";
import { sortSpecs } from "./spec-order";

/**
 * Full-detail overlay opened by tapping a card, within the same Ex-UK shell (no site chrome) —
 * shows everything the teaser card truncates: every photo, the full spec list, and the full
 * description. The bottom action row performs the real pass/love decision (same as swiping the
 * card); the close button just dismisses the sheet without deciding anything.
 */
export function ExUkProductDetail({
  product,
  savings,
  onClose,
  onSwipe,
}: {
  product: Product;
  savings?: Savings | null;
  onClose: () => void;
  onSwipe: (direction: "left" | "right") => void;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(true);
  const handleThumbnailWheel = useHorizontalWheelPassthrough<HTMLDivElement>();
  const image = product.images[photoIndex] ?? product.images[0];
  const price = product.priceRange.minVariantPrice;
  const specs = sortSpecs(product.specs);
  const grade = gradeForProduct(product.tags);

  useEffect(() => {
    closeButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${product.title} details`}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      <div className="flex shrink-0 items-center border-b border-border-subtle px-4 py-3">
        <button
          ref={closeButtonRef}
          onClick={onClose}
          aria-label="Close details"
          className="flex h-9 w-9 items-center justify-center rounded-control text-2xl leading-none hover:bg-neutral-100"
        >
          &times;
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="relative aspect-square w-full bg-neutral-100">
          <ProductMedia image={image} title={product.title} productType={product.productType} sizes="100vw" priority />
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
            <h2 className="flex items-center gap-1.5 text-lg font-semibold leading-snug">
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
                  stroke="var(--background)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </h2>
            <p className="shrink-0 text-lg font-medium">{formatPrice(price.amount, price.currencyCode)}</p>
          </div>

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
              className="rounded-card bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-700 [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_li]:mb-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
            />
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-center gap-6 border-t border-border-subtle py-4">
        <button
          type="button"
          aria-label={`Pass on ${product.title}`}
          onClick={() => onSwipe("left")}
          className="flex h-14 w-14 items-center justify-center rounded-control border border-border-subtle text-neutral-500 shadow-sm transition hover:border-neutral-400 hover:text-neutral-700"
        >
          <PassIcon className="h-6 w-6" />
        </button>
        {WHATSAPP_NUMBER ? (
          <WhatsAppOrderButton
            productTitle={product.title}
            price={formatPrice(price.amount, price.currencyCode)}
            productHandle={product.handle}
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
          aria-label={`Love ${product.title}`}
          onClick={() => onSwipe("right")}
          className="flex h-14 w-14 items-center justify-center rounded-control bg-accent text-accent-foreground shadow-md transition hover:opacity-90"
        >
          <HeartIcon className="h-7 w-7 drop-shadow-sm" />
        </button>
      </div>
    </div>
  );
}
