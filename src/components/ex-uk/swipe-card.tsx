"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import type { Product } from "@/lib/shopify/types";
import { ExUkProductCard } from "./ex-uk-product-card";

const COMMIT_DISTANCE = 110;
const COMMIT_VELOCITY = 0.5;

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startTime: number;
};

export type SwipeCardHandle = {
  swipe: (direction: "left" | "right") => void;
};

/** The single draggable top card in the deck. Drag with pointer events, or call `swipe()` imperatively from the deck's ❤️/✕ buttons. */
export const SwipeCard = forwardRef<SwipeCardHandle, { product: Product; onSwiped: (direction: "left" | "right") => void }>(
  function SwipeCard({ product, onSwiped }, ref) {
    const [delta, setDelta] = useState({ x: 0, y: 0 });
    const [exiting, setExiting] = useState<"left" | "right" | null>(null);
    const dragRef = useRef<DragState | null>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    function commit(direction: "left" | "right") {
      dragRef.current = null;
      setExiting(direction);
    }

    useImperativeHandle(ref, () => ({ swipe: commit }));

    function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
      if (exiting) return;
      cardRef.current?.setPointerCapture(e.pointerId);
      dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, startTime: Date.now() };
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
      } else {
        dragRef.current = null;
        setDelta({ x: 0, y: 0 });
      }
    }

    const isDragging = dragRef.current !== null;
    const rotate = Math.max(-15, Math.min(15, delta.x / 12));
    const stampOpacity = Math.min(1, Math.abs(delta.x) / COMMIT_DISTANCE);

    const transform = exiting
      ? `translate(${exiting === "right" ? 600 : -600}px, ${delta.y}px) rotate(${exiting === "right" ? 30 : -30}deg)`
      : `translate(${delta.x}px, ${delta.y}px) rotate(${rotate}deg)`;

    return (
      <div
        ref={cardRef}
        role="group"
        aria-label={`${product.title}, swipe right to love or left to pass`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onTransitionEnd={() => {
          if (exiting) onSwiped(exiting);
        }}
        style={{
          transform,
          transition: isDragging ? "none" : "transform 300ms ease-out",
          touchAction: "pan-y",
        }}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
      >
        <ExUkProductCard product={product} />
        <span
          aria-hidden="true"
          style={{ opacity: delta.x > 0 ? stampOpacity : 0 }}
          className="pointer-events-none absolute right-4 top-4 -rotate-12 rounded-control border-4 border-accent px-3 py-1 text-lg font-bold text-accent"
        >
          LOVE
        </span>
        <span
          aria-hidden="true"
          style={{ opacity: delta.x < 0 ? stampOpacity : 0 }}
          className="pointer-events-none absolute left-4 top-4 rotate-12 rounded-control border-4 border-neutral-500 px-3 py-1 text-lg font-bold text-neutral-500"
        >
          NOPE
        </span>
      </div>
    );
  },
);
