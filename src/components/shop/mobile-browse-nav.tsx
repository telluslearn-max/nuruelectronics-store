"use client";

import Link from "next/link";
import { useState } from "react";
import { getNavEntries } from "@/lib/nav-entries";

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
                <Link href={entry.href} className="flex-1 px-4 py-3.5 text-sm font-medium">
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
