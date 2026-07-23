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
  chips: string[];
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
    chips: ["🔋 Battery health ≥ 90%", "✅ All ports & buttons tested", "✨ Like-new cosmetic condition"],
  },
  {
    tag: "condition-b",
    label: "Grade B",
    description: "Light wear, fully functional",
    badgeClass: "bg-amber-500/15 text-amber-700",
    dotClass: "bg-amber-500",
    cardBadgeClass: "bg-amber-600 text-white",
    chips: ["🔋 Battery health ≥ 80%", "✅ All ports & buttons tested", "〰️ Light cosmetic wear only"],
  },
  {
    tag: "condition-c",
    label: "Grade C",
    description: "Visible wear, fully functional",
    badgeClass: "bg-orange-500/15 text-orange-700",
    dotClass: "bg-orange-500",
    cardBadgeClass: "bg-orange-600 text-white",
    chips: ["🔋 Battery health ≥ 75%", "✅ All ports & buttons tested", "👀 Visible wear, fully functional"],
  },
];

export function gradeForProduct(tags: string[]): ConditionGrade | null {
  return CONDITION_GRADES.find((grade) => tags.includes(grade.tag)) ?? null;
}
