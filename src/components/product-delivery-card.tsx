// Copy/icons mirror trust-badges.tsx BADGES[0] and BADGES[1] — keep in sync
// if delivery messaging changes. Duplicated rather than reusing TrustBadges
// directly since that component's 4-item icon-on-top grid is a different
// layout, used elsewhere, and shouldn't be reshaped for this page's needs.
const DELIVERY_FACTS = [
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
];

export function ProductDeliveryCard() {
  return (
    <div className="rounded-card border border-border-subtle p-4">
      <div className="space-y-4">
        {DELIVERY_FACTS.map((fact) => (
          <div key={fact.title} className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-50 text-accent">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {fact.icon}
              </svg>
            </span>
            <div>
              <p className="text-sm font-medium">{fact.title}</p>
              <p className="text-sm text-neutral-500">{fact.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
