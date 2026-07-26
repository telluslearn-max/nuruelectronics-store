"use client";

import { useEffect, useState } from "react";

const DISMISSED_KEY = "nuru:ex-uk-notice-dismissed";

/**
 * One-time explainer that Ex-UK matches/messages live only in this browser's localStorage (see
 * use-ex-uk-matches.ts / use-ex-uk-inbox.ts) — no account, no server sync — so a cleared cache or
 * a different device loses them. Shown once on the Discover screen, then dismissed for good.
 */
export function ExUkLocalStorageNotice() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(window.localStorage.getItem(DISMISSED_KEY) === "1");
  }, []);

  if (dismissed) return null;

  function dismiss() {
    window.localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="flex items-start gap-3 border-b border-border-subtle bg-neutral-50 px-4 py-2.5 text-xs text-neutral-600">
      <p className="flex-1">
        Matches and messages are saved only on this device &mdash; they won&apos;t sync to another
        device or survive clearing your browser data.
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 font-medium text-neutral-500 hover:text-neutral-700"
      >
        Got it
      </button>
    </div>
  );
}
