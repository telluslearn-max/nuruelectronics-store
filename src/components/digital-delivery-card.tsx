// Delivery messaging for digital goods (gift cards) — ProductDeliveryCard's
// "Fast Nairobi Delivery" / "Countrywide Shipping" copy would be actively
// wrong here, since nothing physical ships.
const DELIVERY_FACTS = [
  {
    title: "Digital Delivery",
    body: "Your code is sent via WhatsApp or email after payment, usually within a few hours.",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
  },
  {
    title: "No Shipping Needed",
    body: "This is a digital code, not a physical item — nothing is shipped.",
    icon: (
      <>
        <rect x="3" y="8" width="18" height="12" rx="1.5" />
        <path d="M3 12h18" />
      </>
    ),
  },
];

export function DigitalDeliveryCard() {
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
