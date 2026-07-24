"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCompare } from "./compare-context";

function ChevronIcon() {
  return (
    <svg viewBox="0 0 12 8" className="h-2.5 w-2.5 -rotate-90" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 1.5 6 6.5 11 1.5" />
    </svg>
  );
}

export function CompareTray() {
  const { items, clearCompare } = useCompare();
  const pathname = usePathname();

  if (items.length === 0 || pathname === "/compare") return null;

  return (
    <div
      className="fixed left-4 z-40 animate-scale-in origin-bottom-left md:left-6"
      style={{
        bottom: "calc(var(--dock-clear) + env(safe-area-inset-bottom) + (var(--buy-bar-visible) * 4.75rem))",
      }}
    >
      <div className="flex items-center gap-3 rounded-control border border-border-subtle bg-background py-2 pl-2 pr-3 shadow-lg">
        <button
          type="button"
          onClick={clearCompare}
          aria-label="Clear compare list"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg leading-none text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        >
          &times;
        </button>
        <div className="flex -space-x-3">
          {items.map((item) =>
            item.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- tiny stacked thumbnail, not worth next/image's overhead here
              <img
                key={item.handle}
                src={item.image}
                alt=""
                className="h-9 w-9 rounded-full border-2 border-background bg-neutral-100 object-cover"
              />
            ) : (
              <span
                key={item.handle}
                className="h-9 w-9 rounded-full border-2 border-background bg-neutral-100"
              />
            ),
          )}
        </div>
        <Link href="/compare" className="flex items-center gap-1 text-sm font-medium">
          Compare ({items.length})
          <ChevronIcon />
        </Link>
      </div>
    </div>
  );
}
