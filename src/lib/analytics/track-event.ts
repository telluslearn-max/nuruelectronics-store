"use client";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** No-ops when GA4 isn't configured (NEXT_PUBLIC_GA_MEASUREMENT_ID unset) or gtag hasn't loaded yet. */
export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", name, params);
}
