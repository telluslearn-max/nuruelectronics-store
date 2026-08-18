"use client";

import { useRef } from "react";
import { useHorizontalWheelPassthrough } from "./use-horizontal-wheel-passthrough";

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12.5 4 6 10l6.5 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7.5 4 14 10l-6.5 6" />
    </svg>
  );
}

/**
 * Wraps a horizontally-scrolling row with visible prev/next buttons.
 * Native swipe/scroll still works on touch; the buttons exist mainly for
 * desktop, where nothing else signals there's more to see off-screen.
 */
export function CarouselShell({ children }: { children: React.ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);

  function scroll(direction: 1 | -1) {
    trackRef.current?.scrollBy({ left: direction * 320, behavior: "smooth" });
  }

  const handleWheel = useHorizontalWheelPassthrough<HTMLDivElement>();

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onWheel={handleWheel}
        className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-smooth px-4 pb-1 sm:mx-0 sm:px-0"
      >
        {children}
      </div>
      {/* Always visible at sm+ rather than hover-only: hover-gated buttons are
          unreachable on touch tablets, which have no hover state but do land
          in this breakpoint. */}
      <button
        type="button"
        aria-label="Scroll left"
        onClick={() => scroll(-1)}
        className="absolute left-0 top-1/2 hidden -translate-x-3 -translate-y-1/2 rounded-full border border-border-subtle bg-background p-3.5 shadow-md transition hover:border-foreground sm:flex"
      >
        <ChevronLeftIcon />
      </button>
      <button
        type="button"
        aria-label="Scroll right"
        onClick={() => scroll(1)}
        className="absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-3 rounded-full border border-border-subtle bg-background p-3.5 shadow-md transition hover:border-foreground sm:flex"
      >
        <ChevronRightIcon />
      </button>
    </div>
  );
}
