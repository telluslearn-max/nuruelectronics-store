"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CycleStatus } from "@/lib/capital-circle/cycle-status";

function minutesAgo(ms: number): string {
  const minutes = Math.round((Date.now() - ms) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
}

/**
 * The one visible answer to "is this thing actually doing anything right now" — the hourly cycle
 * has no live browser view of its own (it's a cron-triggered server route, not something rendered
 * to a page while it runs), so this is the closest honest substitute: a cheap, already-available
 * signal (CapitalCircleCycleLog.finishedAt === null) rendered plainly, refreshed automatically
 * only while it matters.
 *
 * Polls by re-running the server component (router.refresh(), real data, not a separate API
 * route) every 8s, but only while status.state is "scanning" — a cycle finishes in well under a
 * minute in the typical case, so this stops itself the moment there's nothing left to catch.
 */
export function ScanStatus({ status }: { status: CycleStatus }) {
  const router = useRouter();
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (status.state !== "scanning") return;
    const interval = setInterval(() => {
      router.refresh();
      forceTick((n) => n + 1); // also re-render the "Xm ago" text between refreshes
    }, 8_000);
    return () => clearInterval(interval);
  }, [status.state, router]);

  if (status.state === "never-run") {
    return (
      <div className="mt-3 inline-flex items-center gap-2 rounded-control border border-border-subtle px-3 py-2 text-sm text-neutral-500">
        <span className="h-2 w-2 rounded-full bg-neutral-300" />
        No scan has run yet.
      </div>
    );
  }

  if (status.state === "scanning") {
    return (
      <div className="mt-3 inline-flex items-center gap-2 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
        </span>
        Scanning the market now — started {minutesAgo(status.startedAtMs)}
      </div>
    );
  }

  const label = status.stale ? "Last attempt" : "Last scan";
  const summary = status.lastSummary || (status.stale ? "didn't finish cleanly" : "no summary recorded");

  return (
    <div className="mt-3 inline-flex max-w-full items-start gap-2 rounded-control border border-border-subtle px-3 py-2 text-sm text-neutral-600">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${status.stale ? "bg-amber-400" : "bg-neutral-400"}`} />
      <span className="min-w-0">
        <span className="font-medium">
          {label}: {minutesAgo(status.lastStartedAtMs)}
        </span>
        <span className="block truncate text-neutral-500">{summary}</span>
      </span>
    </div>
  );
}
