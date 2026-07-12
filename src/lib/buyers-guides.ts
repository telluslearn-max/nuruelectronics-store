export type BuyersGuideStep = {
  title: string;
  description: string;
};

export type BuyersGuide = {
  /** Product tag that gates this guide onto a PDP, e.g. "esim". */
  tag: string;
  eyebrow: string;
  title: string;
  /** Short eligibility/requirements checklist shown above the steps. */
  requirements: string[];
  steps: BuyersGuideStep[];
  disclaimer: string;
};

/**
 * Reusable, non-brand-specific guides — one entry serves every product
 * carrying its tag, so this doesn't need per-product authoring.
 */
export const buyersGuides: BuyersGuide[] = [
  {
    tag: "esim",
    eyebrow: "Buyer's Guide",
    title: "Setting up eSIM on this phone",
    requirements: [
      "A Safaricom, Airtel, or Telkom line that supports eSIM",
      "Your national ID or passport for activation",
      "An eSIM-compatible, network-unlocked device",
    ],
    steps: [
      {
        title: "Convert via your carrier app",
        description:
          "Open your carrier's app or dial their SIM-swap USSD code, request an eSIM conversion, and verify your identity.",
      },
      {
        title: "Install your eSIM",
        description:
          "Go to Settings → Mobile Data/Cellular → Add eSIM — scan the QR code your carrier sends you or follow the in-app instructions.",
      },
      {
        title: "You're live",
        description:
          "Test your calls and data. Remove your physical SIM if you no longer need it.",
      },
    ],
    disclaimer:
      "eSIM availability depends on your carrier and device model. All warranty information is subject to the manufacturer's terms — variant features are hardware-level and cannot be changed after purchase.",
  },
];

export function getBuyersGuide(tags: string[]): BuyersGuide | undefined {
  return buyersGuides.find((guide) => tags.includes(guide.tag));
}
