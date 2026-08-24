"use client";

import { useState, type ReactNode } from "react";

/**
 * Toggles visibility only — every panel is still server-rendered up front, passed in as `content`,
 * so switching tabs never re-fetches or drops a Server Action's binding. Keeps the six money-flow
 * cards this replaced from all being open by default, without a page navigation or client fetch.
 */
export function Tabs({ tabs }: { tabs: { id: string; label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  return (
    <div>
      <div role="tablist" className="flex gap-1 rounded-control bg-neutral-100 p-1 text-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => setActive(tab.id)}
            className={`flex-1 rounded-control px-3 py-1.5 font-medium transition ${
              active === tab.id ? "bg-white text-foreground shadow-sm" : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.id} hidden={active !== tab.id} className="mt-4">
          {tab.content}
        </div>
      ))}
    </div>
  );
}
