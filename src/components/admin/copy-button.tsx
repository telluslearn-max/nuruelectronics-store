"use client";

import { useState } from "react";

type Status = "idle" | "copied" | "failed";

/**
 * navigator.clipboard is undefined in an insecure context (plain HTTP, non-localhost) — exactly
 * how someone first opens an admin page from a phone on the LAN. Falls back to a "select and
 * copy manually" message rather than a silent no-op, since a copy button that quietly does
 * nothing on a wallet address is worse than no button at all.
 */
export function CopyButton({ value, label = "Copy", className }: { value: string; label?: string; className?: string }) {
  const [status, setStatus] = useState<Status>("idle");

  async function handleClick() {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard API unavailable (insecure context).");
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    setTimeout(() => setStatus("idle"), 1500);
  }

  return (
    <span className="inline-flex items-center gap-2">
      {/* min-h-9 is a floor, not a fixed size — composes with whatever padding a caller passes
          (some contexts here use py-0.5, which alone is well under a comfortable tap target)
          rather than every call site needing to remember to size itself for touch. */}
      <button type="button" onClick={handleClick} className={`min-h-9 ${className ?? ""}`}>
        {status === "copied" ? "Copied" : label}
      </button>
      <span aria-live="polite" className="text-xs text-red-600">
        {status === "failed" ? "Copy failed — select and copy manually." : ""}
      </span>
    </span>
  );
}
