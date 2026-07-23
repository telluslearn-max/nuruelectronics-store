"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type CompareItem = { handle: string; title: string; image?: string };

export const MAX_COMPARE = 3;

const STORAGE_KEY = "nuru:compare";

type CompareContextValue = {
  items: CompareItem[];
  isComparing: (handle: string) => boolean;
  isFull: boolean;
  toggleCompare: (item: CompareItem) => void;
  removeFromCompare: (handle: string) => void;
  clearCompare: () => void;
};

const CompareContext = createContext<CompareContextValue | null>(null);

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CompareItem[]>([]);

  // Hydrate from localStorage after mount only (localStorage is an external system, and reading
  // it after mount rather than during render is what avoids a server/client hydration mismatch) —
  // same convention as useExUkMatches.
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
      // Storage full/unavailable (private browsing, etc.) — compare list
      // just won't persist across reloads; not worth surfacing to the user.
    }
  }, [items]);

  const value = useMemo<CompareContextValue>(
    () => ({
      items,
      isComparing: (handle) => items.some((i) => i.handle === handle),
      isFull: items.length >= MAX_COMPARE,
      toggleCompare: (item) =>
        setItems((prev) => {
          if (prev.some((i) => i.handle === item.handle)) {
            return prev.filter((i) => i.handle !== item.handle);
          }
          if (prev.length >= MAX_COMPARE) return prev;
          return [...prev, item];
        }),
      removeFromCompare: (handle) => setItems((prev) => prev.filter((i) => i.handle !== handle)),
      clearCompare: () => setItems([]),
    }),
    [items],
  );

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error("useCompare must be used within a CompareProvider");
  return ctx;
}
