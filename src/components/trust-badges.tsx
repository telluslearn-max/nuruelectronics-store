const BADGES = [
  {
    title: "Fast Nairobi Delivery",
    body: "Order today, unbox today in Nairobi.",
    icon: (
      <>
        <rect x="2" y="8" width="12" height="8" rx="1" />
        <path d="M14 11h4l3 3v2h-7" />
        <circle cx="7" cy="18" r="1.6" />
        <circle cx="17" cy="18" r="1.6" />
      </>
    ),
  },
  {
    title: "Countrywide Shipping",
    body: "We deliver to every corner of Kenya.",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.5 3.8 5.7 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.7-3.8-9S9.5 5.5 12 3z" />
      </>
    ),
  },
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
