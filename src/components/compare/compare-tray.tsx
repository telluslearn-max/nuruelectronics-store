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
  const { items, clearCompare, removeFromCompare } = useCompare();
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
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg leading-none text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        >
          &times;
        </button>
        <div className="flex gap-1">
          {items.map((item) => (
            <div key={item.handle} className="relative">
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- tiny stacked thumbnail, not worth next/image's overhead here
                <img
                  src={item.image}
                  alt=""
                  className="h-9 w-9 rounded-full border-2 border-background bg-neutral-100 object-cover"
                />
              ) : (
                <span className="block h-9 w-9 rounded-full border-2 border-background bg-neutral-100" />
              )}
              <button
                type="button"
                onClick={() => removeFromCompare(item.handle)}
                aria-label={`Remove ${item.title} from compare`}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-background bg-neutral-700 text-[10px] leading-none text-white"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
        <Link href="/compare" className="flex items-center gap-1 text-sm font-medium">
          Compare ({items.length})
          <ChevronIcon />
        </Link>
      </div>
    </div>
  );
}
