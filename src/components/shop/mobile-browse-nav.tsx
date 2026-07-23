"use client";

import Link from "next/link";
import { useState } from "react";
import type { ArtKind } from "@/lib/categories";
import { getNavEntries, type NavIconKind } from "@/lib/nav-entries";
import { ArtGlyph } from "@/components/product-media";

const CATEGORY_ART_KINDS = new Set<NavIconKind>([
  "phone",
  "tablet",
  "buds",
  "watch",
  "charger",
  "laptop",
  "gaming",
  "camera",
  "appliance",
  "generic",
]);

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 8"
      className={className ?? "h-2.5 w-2.5"}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 1.5 6 6.5 11 1.5" />
    </svg>
  );
}

function ShopBagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 8V6a4 4 0 1 1 8 0v2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 8h13l1 12.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5Z" />
    </svg>
  );
}

function BrandTagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.5 3.5h6a2 2 0 0 1 2 2v6a2 2 0 0 1-.6 1.4l-8 8a2 2 0 0 1-2.8 0l-6-6a2 2 0 0 1 0-2.8l8-8a2 2 0 0 1 1.4-.6Z" />
      <circle cx="15.5" cy="7.5" r="1.5" />
    </svg>
  );
}

function NeedTargetIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.5" fill="currentColor" />
    </svg>
  );
}

function ExUkPinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-6.5 7-11.5a7 7 0 1 0-14 0C5 14.5 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

function SupportChatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-7Z"
      />
      <path strokeLinecap="round" d="M8 9h8M8 12.5h5" />
    </svg>
  );
}

function NavIcon({ kind, className }: { kind: NavIconKind; className?: string }) {
  if (CATEGORY_ART_KINDS.has(kind)) {
    return <ArtGlyph kind={kind as ArtKind} className={className} />;
  }
  switch (kind) {
    case "shop":
      return <ShopBagIcon className={className} />;
    case "brand":
      return <BrandTagIcon className={className} />;
    case "need":
      return <NeedTargetIcon className={className} />;
    case "ex-uk":
      return <ExUkPinIcon className={className} />;
    case "support":
      return <SupportChatIcon className={className} />;
    default:
      return null;
  }
}

export function MobileBrowseNav() {
  const entries = getNavEntries();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="md:hidden">
      <h2 className="text-lg font-medium">Browse</h2>
      <ul className="mt-4 overflow-hidden rounded-card border border-border-subtle">
        {entries.map((entry, index) => {
          const isExpanded = expandedIds.has(entry.id);
          return (
            <li key={entry.id} className={index > 0 ? "border-t border-border-subtle" : undefined}>
              <div className="flex items-center">
                <Link href={entry.href} className="flex flex-1 items-center gap-3 px-4 py-3.5 text-sm font-medium">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-neutral-50 text-neutral-500">
                    <NavIcon kind={entry.icon} className="h-4 w-4" />
                  </span>
                  {entry.label}
                </Link>
                {entry.panelItems.length > 0 && (
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={`mobile-browse-panel-${entry.id}`}
                    onClick={() => toggleExpanded(entry.id)}
                    className="p-4 text-neutral-400 transition hover:text-foreground"
                  >
                    <ChevronIcon
                      className={`h-2.5 w-2.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                    <span className="sr-only">Toggle {entry.label} submenu</span>
                  </button>
                )}
              </div>
              {entry.panelItems.length > 0 && isExpanded && (
                <ul id={`mobile-browse-panel-${entry.id}`} className="space-y-1 bg-neutral-50 px-6 py-2">
                  {entry.panelItems.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href} className="block py-2 text-sm text-neutral-600">
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
