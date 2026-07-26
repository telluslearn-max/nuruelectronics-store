"use client";

import { useEffect, useRef } from "react";
import { ConciergeMessageList } from "./concierge-message-list";
import type { ConciergeDisplayMessage } from "./use-concierge-messages";

export function ConciergeSheet({
  messages,
  isStreaming,
  onCollapse,
  children,
}: {
  messages: ConciergeDisplayMessage[];
  isStreaming: boolean;
  onCollapse: () => void;
  children?: React.ReactNode;
}) {
  const collapseButtonRef = useRef<HTMLButtonElement>(null);

  // Move focus into the panel when it mounts, matching cart-drawer.tsx's pattern — the parent
  // (concierge-dock.tsx) owns Escape/outside-click-to-collapse since the FAB/sheet swap lives
  // there, and also returns focus to the FAB when this unmounts.
  useEffect(() => {
    collapseButtonRef.current?.focus();
  }, []);

  return (
    <div
      role="dialog"
      aria-label="Shopping concierge"
      className="flex w-[calc(100vw-2rem)] max-w-sm max-h-[70vh] origin-bottom-right animate-scale-in flex-col overflow-hidden rounded-card border border-border-subtle bg-background shadow-2xl md:w-96 md:max-h-[32rem]"
    >
      <div className="flex items-center justify-between border-b border-border-subtle p-4">
        <div>
          <h2 className="text-base font-semibold">Shopping concierge</h2>
          <p className="text-xs text-neutral-400">AI-powered &middot; can make mistakes</p>
        </div>
        <button
          ref={collapseButtonRef}
          onClick={onCollapse}
          aria-label="Collapse concierge"
          className="flex h-11 w-11 items-center justify-center rounded-control text-2xl leading-none hover:bg-neutral-100"
        >
          &times;
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ConciergeMessageList messages={messages} isStreaming={isStreaming} />
      </div>
      {children}
    </div>
  );
}
