"use client";

import { useCallback, useEffect, useState } from "react";

export type ExUkBrand = "iphone" | "android" | "all";

const STORAGE_KEY = "nuru:ex-uk-brand";

function readStoredBrand(): ExUkBrand | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === "iphone" || raw === "android" || raw === "all" ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Which brand lane the shopper picked in the onboarding screen (ex-uk-brand-onboarding.tsx) —
 * persisted so returning shoppers skip straight to their deck instead of re-answering. `null`
 * means "not chosen yet" (onboarding still needs to show); "all" is a deliberate choice made via
 * the "show me everything" option, not the same as unset. Mirrors use-ex-uk-matches.ts's
 * localStorage-only persistence — no account or server state required.
 */
export function useExUkBrand() {
  const [brand, setBrandState] = useState<ExUkBrand | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBrandState(readStoredBrand());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);

  const setBrand = useCallback((next: ExUkBrand) => {
    setBrandState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  return { brand, setBrand, hydrated };
}
