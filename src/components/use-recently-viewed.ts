"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "nuru:recently-viewed";
const MAX_ENTRIES = 12;

function readHandles(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/** Records the current product as viewed, most-recent-first, capped at MAX_ENTRIES. */
export function useRecordProductView(handle: string) {
  useEffect(() => {
    const next = [handle, ...readHandles().filter((h) => h !== handle)].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, [handle]);
}

/** Reads the recently-viewed handle list, excluding the product currently being viewed. */
export function useRecentlyViewedHandles(excludeHandle: string): string[] {
  const [handles, setHandles] = useState<string[]>([]);

  // Hydrate from localStorage after mount only — reading it during render would
  // create a server/client hydration mismatch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHandles(readHandles().filter((h) => h !== excludeHandle));
  }, [excludeHandle]);

  return handles;
}
