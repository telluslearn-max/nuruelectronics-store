"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import type { Savings } from "@/lib/product-match";
import type { Product } from "@/lib/shopify/types";
import { ExUkProductCard } from "./ex-uk-product-card";

const COMMIT_DISTANCE = 110;
const COMMIT_VELOCITY = 0.5;
// Pointer movement below this (in px) on release is treated as a tap rather than an aborted
// drag — opens the detail overlay instead of just springing the card back to center.
const TAP_THRESHOLD = 6;
// A well-known "back out" bezier — overshoots past 100% then settles, reads as a springy snap
// rather than a mechanical linear return. Used for the release-to-center animation only; the
// commit fly-away keeps a plain ease-out since it's leaving, not settling.
const SPRING_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)";

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startTime: number;
};

export type SwipeCardHandle = {
  swipe: (direction: "left" | "right") => void;
};

/** x in [0,1] → overshoots past 1 before settling — used to give the stamp a "pop" as the drag approaches commit distance, computed per-frame so it stays in lockstep with the live drag instead of animating on a delay. */
function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const t = x - 1;
  return 1 + c3 * t * t * t + c1 * t * t;
}

// Faux text-outline via layered shadows — works everywhere (unlike -webkit-text-stroke, which
// Firefox doesn't support at all); -webkit-text-stroke is layered on top below as a crisper
// enhancement where it is supported.
function outlineShadow(color: string): string {
  const offsets: [number, number][] = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
    [0, -1.6],
    [0, 1.6],
    [-1.6, 0],
    [1.6, 0],
  ];
  return offsets.map(([x, y]) => `${x * 1.5}px ${y * 1.5}px 0 ${color}`).join(", ");
}

function Stamp({
  label,
  color,
  glow,
  side,
  opacity,
  scale,
}: {
  label: string;
  color: string;
  glow: string;
  side: "left" | "right";
  opacity: number;
  scale: number;
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute top-10 ${side === "right" ? "right-[18%] -rotate-12" : "left-[18%] rotate-12"}`}
      style={{ opacity }}
    >
      <div
        className="absolute inset-0 -z-10 rounded-full blur-2xl"
        style={{ background: `radial-gradient(circle, ${glow}, transparent 70%)`, transform: "scale(2.4)" }}
      />
      <span
        className="block text-4xl font-black italic tracking-wide"
        style={{
          color,
          transform: `scale(${scale})`,
          // Fixed white, not var(--background) — this outlines against ExUkProductCard's own
          // fixed bg-neutral-900 underneath the stamp, not the page background behind the card,
          // which stopped being reliably light once Ex-UK adopted its own dark theme.
          textShadow: outlineShadow("#fff"),
          WebkitTextStroke: "2.5px #fff",
          paintOrder: "stroke fill",
          filter: "drop-shadow(0 3px 5px rgba(0,0,0,0.35))",
        }}
      >
        {label}
      </span>
    </div>
  );
}

/** The single draggable top card in the deck. Drag with pointer events, or call `swipe()` imperatively from the deck's pass button. */
export const SwipeCard = forwardRef<
  SwipeCardHandle,
  {
    product: Product;
    savings?: Savings | null;
    onSwiped: (direction: "left" | "right") => void;
    onTap?: () => void;
    /** Card's own bookmark badge — saves to the wishlist (independent of the swipe decision, does
     * not advance the deck), see use-ex-uk-bookmark.ts. */
    bookmarked?: boolean;
    onBookmark?: () => void;
  }
>(function SwipeCard({ product, savings, onSwiped, onTap, bookmarked, onBookmark }, ref) {
    const [delta, setDelta] = useState({ x: 0, y: 0 });
    const [exiting, setExiting] = useState<"left" | "right" | null>(null);
    const dragRef = useRef<DragState | null>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    const [isDragging, setIsDragging] = useState(false);

    function commit(direction: "left" | "right") {
      dragRef.current = null;
      setIsDragging(false);
      setExiting(direction);
    }

    useImperativeHandle(ref, () => ({ swipe: commit }));

    function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
      if (exiting) return;
      cardRef.current?.setPointerCapture(e.pointerId);
      dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, startTime: Date.now() };
      setIsDragging(true);
    }

    function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      setDelta({ x: e.clientX - drag.startX, y: e.clientY - drag.startY });
    }

    function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const elapsed = Math.max(Date.now() - drag.startTime, 1);
      const velocity = delta.x / elapsed;
      if (Math.abs(delta.x) > COMMIT_DISTANCE || Math.abs(velocity) > COMMIT_VELOCITY) {
        commit(delta.x > 0 ? "right" : "left");
        return;
      }
      const wasTap = Math.hypot(delta.x, delta.y) < TAP_THRESHOLD;
      dragRef.current = null;
      setIsDragging(false);
      setDelta({ x: 0, y: 0 });
      if (wasTap) onTap?.();
    }

    const rotate = Math.max(-15, Math.min(15, delta.x / 12));
    const commitProgress = Math.min(1, Math.abs(delta.x) / COMMIT_DISTANCE);
    const stampOpacity = commitProgress;
    const stampScale = 0.6 + 0.6 * easeOutBack(commitProgress);

    const transform = exiting
      ? `translate(${exiting === "right" ? 600 : -600}px, ${delta.y}px) rotate(${exiting === "right" ? 30 : -30}deg)`
      : `translate(${delta.x}px, ${delta.y}px) rotate(${rotate}deg)`;
    const transition = isDragging ? "none" : exiting ? "transform 300ms ease-out" : `transform 400ms ${SPRING_EASE}`;

    return (
      <div
        ref={cardRef}
        role="group"
        tabIndex={0}
        aria-label={`${product.title}, swipe right to love or left to pass, or press Enter for details`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onTap?.();
          }
        }}
        onTransitionEnd={() => {
          if (exiting) onSwiped(exiting);
        }}
        style={{ transform, transition, touchAction: "pan-y" }}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
      >
        <ExUkProductCard product={product} savings={savings} bookmarked={bookmarked} onBookmark={onBookmark} />
        <Stamp
          label="LOVE"
          side="right"
          color="var(--accent)"
          glow="rgba(212,71,46,0.55)"
          opacity={delta.x > 0 ? stampOpacity : 0}
          scale={stampScale}
        />
        <Stamp
          label="NOPE"
          side="left"
          color="var(--nope-stamp)"
          glow="var(--nope-stamp-glow)"
          opacity={delta.x < 0 ? stampOpacity : 0}
          scale={stampScale}
        />
      </div>
    );
  },
);
