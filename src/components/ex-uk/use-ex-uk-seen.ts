"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "nuru:ex-uk-seen";

function readSeenHandles(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Tracks which Ex-UK product handles this browser has already swiped on (either direction), so
 * returning to the discover deck doesn't re-show cards already passed on or matched with. Mirrors
 * use-ex-uk-matches.ts's localStorage-only persistence — no account or server state required.
 */
export function useExUkSeen() {
  const [seen, setSeen] = useState<Set<string>>(new Set());

  // Hydrate from localStorage after mount only, same reasoning as useExUkMatches — reading it
  // during render would create a server/client hydration mismatch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeen(new Set(readSeenHandles()));
  }, []);

  const markSeen = useCallback((handle: string) => {
    setSeen((prev) => {
      if (prev.has(handle)) return prev;
      const next = new Set(prev);
      next.add(handle);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const unmarkSeen = useCallback((handle: string) => {
    setSeen((prev) => {
      if (!prev.has(handle)) return prev;
      const next = new Set(prev);
      next.delete(handle);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  return { seen, markSeen, unmarkSeen };
}
