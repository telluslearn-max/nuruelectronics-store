"use client";

import { useCallback } from "react";

/** Walks up from `element` to find the nearest vertically-scrollable ancestor and scrolls it —
    doesn't assume a fixed DOM depth. Falls back to scrolling the page when no scrollable
    ancestor exists (the common case for a carousel sitting directly in the page flow). */
function scrollNearestVerticalAncestor(element: HTMLElement, deltaY: number) {
  let node: HTMLElement | null = element.parentElement;
  while (node) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight) {
      node.scrollBy({ top: deltaY });
      return;
    }
    node = node.parentElement;
  }
  window.scrollBy({ top: deltaY });
}

/**
 * A vertical mouse-wheel gesture over a horizontal-only `overflow-x-auto` track can otherwise get
 * swallowed instead of scrolling the page (or an ancestor panel) underneath it — some
 * browser/trackpad combinations route any wheel event to the nearest overflow-x scroller
 * regardless of gesture direction, especially with CSS scroll-snap active (audit findings M1/M5).
 * Attach the returned handler to a horizontal scroll track's `onWheel`; it only intervenes when
 * the gesture is genuinely vertical, leaving horizontal/diagonal scrolling to drive the carousel
 * natively.
 */
export function useHorizontalWheelPassthrough<T extends HTMLElement>() {
  return useCallback((event: React.WheelEvent<T>) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    scrollNearestVerticalAncestor(event.currentTarget, event.deltaY);
  }, []);
}
