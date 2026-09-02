"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

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
  // The persist effect below must not run before the hydrate effect has read the stored list —
  // otherwise it fires on mount with the initial empty `items` and overwrites what's stored, so
  // the compare list is lost on every full page load. Hydrate captures the stored value into a
  // local before that can happen, and its `length` guard makes a strict-mode re-read of a
  // just-cleared key a no-op, so the hydrate still wins.
  const hydratedRef = useRef(false);

  // Hydrate from localStorage after mount only (reading it during render would mismatch the
  // server HTML) — same convention as useExUkMatches.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(parsed) && parsed.length > 0) setItems(parsed as CompareItem[]);
    } catch {
      // Corrupt or inaccessible storage — start empty rather than throw.
    } finally {
      hydratedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
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
