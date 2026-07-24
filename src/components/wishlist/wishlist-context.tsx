"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type WishlistItem = { handle: string; title: string; image?: string };

const STORAGE_KEY = "nuru:wishlist";

type WishlistContextValue = {
  items: WishlistItem[];
  isSaved: (handle: string) => boolean;
  toggleWishlist: (item: WishlistItem) => void;
  removeFromWishlist: (handle: string) => void;
  clearWishlist: () => void;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([]);

  // Hydrate from localStorage after mount only — same convention as
  // useExUkMatches / CompareProvider.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // Corrupt or inaccessible storage — start empty rather than throw.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage full/unavailable (private browsing, etc.) — wishlist just
      // won't persist across reloads; not worth surfacing to the user.
    }
  }, [items]);

  const value = useMemo<WishlistContextValue>(
    () => ({
      items,
      isSaved: (handle) => items.some((i) => i.handle === handle),
      toggleWishlist: (item) =>
        setItems((prev) =>
          prev.some((i) => i.handle === item.handle)
            ? prev.filter((i) => i.handle !== item.handle)
            : [...prev, item],
        ),
      removeFromWishlist: (handle) => setItems((prev) => prev.filter((i) => i.handle !== handle)),
      clearWishlist: () => setItems([]),
    }),
    [items],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within a WishlistProvider");
  return ctx;
}
