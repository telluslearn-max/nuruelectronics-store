"use client";

import { useEffect, useMemo, useState } from "react";
import { ProductCarousel } from "@/components/product-carousel";
import { SectionHeading } from "@/components/section-heading";
import { useRecentlyViewedHandles } from "@/components/use-recently-viewed";
import { useWishlist } from "@/components/wishlist/wishlist-context";
import { getProductsByHandles } from "@/lib/actions";
import { getPersonalizedHomepageProducts } from "@/lib/personalization/recommendations";
import type { Product } from "@/lib/shopify/types";

type TabId = "for-you" | "recently-viewed" | "saved";

/**
 * Homepage "Recommended for you" section — a pill-tab switcher over the shopper's own signals
 * (Gemini-ranked picks, recently viewed, saved/wishlist), each pulled from the existing localStorage
 * hooks rather than a new tracking mechanism. "For You" always renders — it falls back to storewide
 * best sellers server-side when there's no browsing history yet — so first-time visitors still see
 * this section instead of it disappearing; "Recently viewed" and "Saved" only appear once there's
 * actual signal for them.
 */
export function HomeRecommendations() {
  const recentHandles = useRecentlyViewedHandles("");
  const { items: wishlistItems } = useWishlist();
  const savedHandles = useMemo(() => wishlistItems.map((item) => item.handle), [wishlistItems]);

  const tabs = useMemo(() => {
    const available: { id: TabId; label: string }[] = [{ id: "for-you", label: "For You" }];
    if (recentHandles.length > 0) available.push({ id: "recently-viewed", label: "Recently viewed" });
    if (savedHandles.length > 0) available.push({ id: "saved", label: "Saved" });
    return available;
  }, [recentHandles.length, savedHandles.length]);

  const [activeTab, setActiveTab] = useState<TabId | null>(null);
  const [productsByTab, setProductsByTab] = useState<Partial<Record<TabId, Product[]>>>({});

  // Default to the first available tab once we know what there is — "For You" wins when present.
  useEffect(() => {
    if (activeTab === null && tabs.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  useEffect(() => {
    if (!activeTab || productsByTab[activeTab] !== undefined) return;
    let cancelled = false;
    const load =
      activeTab === "for-you"
        ? getPersonalizedHomepageProducts(recentHandles)
        : activeTab === "recently-viewed"
          ? getProductsByHandles(recentHandles)
          : getProductsByHandles(savedHandles);
    load
      .then((fetched) => {
        if (cancelled) return;
        setProductsByTab((prev) => ({ ...prev, [activeTab]: fetched }));
      })
      .catch((error) => {
        console.error(`Failed to load "${activeTab}" recommendations:`, error);
        if (cancelled) return;
        setProductsByTab((prev) => ({ ...prev, [activeTab]: [] }));
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, productsByTab, recentHandles, savedHandles]);

  if (tabs.length === 0) return null;

  const activeProducts = activeTab ? productsByTab[activeTab] : undefined;
  const isLoading = activeProducts === undefined;

  return (
    <section className="mt-16">
      <SectionHeading eyebrow="Picked for you" title="Recommended for you" />
      <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? "border-accent bg-accent/10 text-accent"
                : "border-border-subtle text-neutral-600 hover:border-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {isLoading ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : activeProducts && activeProducts.length > 0 ? (
          <ProductCarousel products={activeProducts} />
        ) : (
          <p className="text-sm text-neutral-500">Nothing to show here yet.</p>
        )}
      </div>
    </section>
  );
}
