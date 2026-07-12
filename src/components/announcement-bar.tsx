"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "nuru-announcement-dismissed";
const MESSAGE = "100% genuine electronics, backed by manufacturer warranty — delivered fast across Kenya.";

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot() {
  return sessionStorage.getItem(STORAGE_KEY) === "1";
}

function getServerSnapshot() {
  return false;
}

function dismiss() {
  sessionStorage.setItem(STORAGE_KEY, "1");
  listeners.forEach((listener) => listener());
}

export function AnnouncementBar() {
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (dismissed) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-surface-dark px-4 py-2 text-center text-xs text-surface-dark-foreground">
      <p className="max-w-[90%] sm:max-w-none">{MESSAGE}</p>
      <button
        type="button"
        aria-label="Dismiss announcement"
        onClick={dismiss}
        className="-m-2 flex h-9 w-9 shrink-0 items-center justify-center p-2 text-neutral-400 transition hover:text-surface-dark-foreground"
      >
        &times;
      </button>
    </div>
  );
}
