import { gradeForProduct } from "@/components/ex-uk/condition-grade";
import { getSavings } from "./pricing";
import type { Money } from "./shopify/types";

export type Badge = { key: string; label: string; className: string };

export function getProductBadges(params: {
  tags: string[];
  availableForSale: boolean;
  price: Money;
  compareAtPrice: Money | null | undefined;
  variant: "card" | "inline";
}): Badge[] {
  const { tags, availableForSale, price, compareAtPrice, variant } = params;

  // Pre-release games are typically unavailable-for-sale (no inventory yet),
  // so this must be checked before the sold-out short-circuit below.
  if (tags.includes("coming-soon")) {
    return [{ key: "coming-soon", label: "Coming Soon", className: "bg-accent/10 text-accent" }];
  }

  if (!availableForSale) {
    return [{ key: "sold-out", label: "Sold out", className: "bg-background text-neutral-600" }];
  }

  const badges: Badge[] = [];

  const grade = gradeForProduct(tags);
  if (grade) {
    badges.push({
      key: `grade-${grade.tag}`,
      label: grade.label,
      className: variant === "card" ? grade.cardBadgeClass : grade.badgeClass,
    });
  }

  if (getSavings(price, compareAtPrice)) {
    badges.push({ key: "price-drop", label: "↘ Price drop", className: "bg-emerald-100 text-emerald-700" });
  }

  return badges;
}
