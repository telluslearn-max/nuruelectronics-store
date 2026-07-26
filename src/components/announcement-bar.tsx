"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { SeasonalTheme } from "@/lib/seasonal-theme";

const STORAGE_KEY = "nuru-announcement-dismissed";
const DEFAULT_MESSAGE = "100% genuine electronics, backed by manufacturer warranty — delivered fast across Kenya.";
// Dismissal persists across browser sessions (localStorage, not sessionStorage), but only for a
// week — so the bar resurfaces periodically rather than being gone forever after one dismiss.
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(storageKey: string) {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_TTL_MS;
}

function getServerSnapshot() {
  return false;
}

function dismiss(storageKey: string) {
  localStorage.setItem(storageKey, String(Date.now()));
  listeners.forEach((listener) => listener());
}

export function AnnouncementBar({ seasonalTheme = null }: { seasonalTheme?: SeasonalTheme | null }) {
  // Keyed by the active theme's id so a visitor who dismissed the evergreen message doesn't
  // permanently miss a newly-activated seasonal one (and vice versa once the season ends).
  const storageKey = `${STORAGE_KEY}:${seasonalTheme?.id ?? "default"}`;
  const getSnapshotForKey = useCallback(() => getSnapshot(storageKey), [storageKey]);
  const dismissed = useSyncExternalStore(subscribe, getSnapshotForKey, getServerSnapshot);

  if (dismissed) return null;

  const message = seasonalTheme?.announcement.message ?? DEFAULT_MESSAGE;
  const barClassName = seasonalTheme?.announcement.barClassName ?? "bg-surface-dark text-surface-dark-foreground";
  const dismissClassName = seasonalTheme?.announcement.dismissClassName ?? "text-neutral-400 hover:text-surface-dark-foreground";

  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-xs ${barClassName}`}>
      <p className="max-w-[90%] sm:max-w-none">{message}</p>
      <button
        type="button"
        aria-label="Dismiss announcement"
        onClick={() => dismiss(storageKey)}
        className={`-m-2 flex h-9 w-9 shrink-0 items-center justify-center p-2 transition ${dismissClassName}`}
      >
        &times;
      </button>
    </div>
  );
}
