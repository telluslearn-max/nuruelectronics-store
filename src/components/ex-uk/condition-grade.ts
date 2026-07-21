export type ConditionGrade = {
  tag: string;
  label: string;
  description: string;
};

// Same pattern as the ex-uk tag itself, and ecosystem/kit tags in src/lib/collections.ts — a
// merchandiser tags each unit in Shopify with its grade. Untagged inventory (including every mock
// product today) falls back to the generic copy wherever this is used, so this is additive and
// doesn't require every listing to have one.
const CONDITION_GRADES: ConditionGrade[] = [
  { tag: "condition-a", label: "Grade A", description: "Like new — no visible wear" },
  { tag: "condition-b", label: "Grade B", description: "Light wear, fully functional" },
  { tag: "condition-c", label: "Grade C", description: "Visible wear, fully functional" },
];

export function gradeForProduct(tags: string[]): ConditionGrade | null {
  return CONDITION_GRADES.find((grade) => tags.includes(grade.tag)) ?? null;
}
