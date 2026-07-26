import type { ReactNode } from "react";

export type DeliveryFact = { title: string; body: string; icon: ReactNode };

/**
 * Single source of truth for the two delivery facts shared by TrustBadges
 * (4-item grid) and ProductDeliveryCard (PDP-specific 2-item stacked card) —
 * keeps copy/icons from drifting between the two layouts.
 */
export const DELIVERY_FACTS: DeliveryFact[] = [
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
