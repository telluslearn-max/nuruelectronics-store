"use client";

import { useCallback, useEffect, useState } from "react";

export type ExUkMatch = {
  handle: string;
  title: string;
  imageUrl: string | null;
  likedAt: number;
};

const STORAGE_KEY = "nuru:ex-uk-matches";

function readStoredMatches(): ExUkMatch[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ExUkMatch[]) : [];
  } catch {
    return [];
  }
}

/** Browser-local "matches" shortlist for the Ex-UK swipe deck — no account or server state required. */
export function useExUkMatches() {
  const [matches, setMatches] = useState<ExUkMatch[]>([]);

  // Hydrate from localStorage after mount only (localStorage is an external system, and reading
  // it after mount rather than during render is what avoids a server/client hydration mismatch).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMatches(readStoredMatches());
  }, []);

  const addMatch = useCallback((match: Omit<ExUkMatch, "likedAt">) => {
    setMatches((prev) => {
      if (prev.some((m) => m.handle === match.handle)) return prev;
      const next = [...prev, { ...match, likedAt: Date.now() }];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeMatch = useCallback((handle: string) => {
    setMatches((prev) => {
      if (!prev.some((m) => m.handle === handle)) return prev;
      const next = prev.filter((m) => m.handle !== handle);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { matches, addMatch, removeMatch };
}
