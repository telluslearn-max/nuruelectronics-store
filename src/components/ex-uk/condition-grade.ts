export type ConditionChipIcon = "battery" | "check" | "wear" | "sparkle";

export type ConditionChip = { icon: ConditionChipIcon; label: string };

export type ConditionGrade = {
  tag: string;
  label: string;
  description: string;
  /** Tailwind classes for the pill background/text/dot — color-coded so grades are distinguishable at a glance, not just by reading the label. */
  badgeClass: string;
  dotClass: string;
  /** Solid variant for the card's badge, which sits directly over a photo and needs more contrast than the translucent detail-overlay pill does. */
  cardBadgeClass: string;
  /** Short, specific benefit claims for this tier, shown as chips in the detail overlay — same copy for every unit of this grade (universal, not per-unit data). */
  chips: ConditionChip[];
};

// Same pattern as the ex-uk tag itself, and ecosystem/kit tags in src/lib/collections.ts — a
// merchandiser tags each unit in Shopify with its grade. Untagged inventory (including every mock
// product today) falls back to the generic copy wherever this is used, so this is additive and
// doesn't require every listing to have one.
const CONDITION_GRADES: ConditionGrade[] = [
  {
    tag: "condition-a",
    label: "Grade A",
    description: "Like new — no visible wear",
    badgeClass: "bg-emerald-500/15 text-emerald-700",
    dotClass: "bg-emerald-500",
    cardBadgeClass: "bg-emerald-600 text-white",
    chips: [
      { icon: "battery", label: "Battery health ≥ 90%" },
      { icon: "check", label: "All ports & buttons tested" },
      { icon: "sparkle", label: "Like-new cosmetic condition" },
    ],
  },
  {
    tag: "condition-b",
    label: "Grade B",
    description: "Light wear, fully functional",
    badgeClass: "bg-amber-500/15 text-amber-700",
    dotClass: "bg-amber-500",
    cardBadgeClass: "bg-amber-600 text-white",
    chips: [
      { icon: "battery", label: "Battery health ≥ 80%" },
      { icon: "check", label: "All ports & buttons tested" },
      { icon: "wear", label: "Light cosmetic wear only" },
    ],
  },
  {
    tag: "condition-c",
    label: "Grade C",
    description: "Visible wear, fully functional",
    // Rose rather than orange/amber's neighboring hue — Grade B and C otherwise sit too close on
    // the color wheel to read as distinct tiers at a glance (worse for colorblind users too).
    badgeClass: "bg-rose-500/15 text-rose-700",
    dotClass: "bg-rose-500",
    cardBadgeClass: "bg-rose-600 text-white",
    chips: [
      { icon: "battery", label: "Battery health ≥ 75%" },
      { icon: "check", label: "All ports & buttons tested" },
      { icon: "wear", label: "Visible wear, fully functional" },
    ],
  },
];

export function gradeForProduct(tags: string[]): ConditionGrade | null {
  return CONDITION_GRADES.find((grade) => tags.includes(grade.tag)) ?? null;
}
