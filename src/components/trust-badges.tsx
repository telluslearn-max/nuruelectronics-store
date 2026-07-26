import { DELIVERY_FACTS } from "@/lib/delivery-facts";

const OTHER_BADGES = [
  {
    title: "100% Genuine Products",
    body: "Every product checked before it ships.",
    icon: (
      <>
        <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
  },
  {
    title: "Manufacturer Warranty",
    body: "Backed by manufacturer warranty on every purchase.",
    icon: (
      <>
        <path d="M12 2l8 3v6c0 5-3.4 8.5-8 11-4.6-2.5-8-6-8-11V5l8-3z" />
        <path d="M12 8v5M12 16h.01" />
      </>
    ),
  },
];

const BADGES = [...DELIVERY_FACTS, ...OTHER_BADGES];

export function TrustBadges() {
  return (
    <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
      {BADGES.map((badge) => (
        <div key={badge.title} className="flex flex-col items-start gap-2">
          <svg
            viewBox="0 0 24 24"
            className="h-7 w-7 text-accent"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {badge.icon}
          </svg>
          <p className="text-sm font-medium">{badge.title}</p>
          <p className="text-sm text-neutral-500">{badge.body}</p>
        </div>
      ))}
    </div>
  );
}
