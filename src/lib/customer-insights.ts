import "server-only";
import type { Feedback, Interaction } from "@prisma/client";
import { prisma } from "./prisma";

export type LifecycleLabel = "new" | "repeat_buyer" | "lapsed";

export const LIFECYCLE_LABELS: Record<LifecycleLabel, string> = {
  new: "New",
  repeat_buyer: "Repeat buyer",
  lapsed: "Lapsed",
};

const LAPSED_DAYS = 180;

/** Rule-based, not Gemini — plain code over facts already on hand (order count + recency), per the
 * guiding rule: inferred/AI-derived signal lives in Interaction, but this label is deterministic. */
export function computeLifecycleLabel(orderCount: number, mostRecentOrderAt: Date | null): LifecycleLabel {
  if (orderCount === 0) return "new";
  if (mostRecentOrderAt) {
    const daysSinceLastOrder = (Date.now() - mostRecentOrderAt.getTime()) / (24 * 60 * 60 * 1000);
    if (daysSinceLastOrder > LAPSED_DAYS) return "lapsed";
  }
  return orderCount > 1 ? "repeat_buyer" : "new";
}

export type CustomerInsights = {
  lifecycle: LifecycleLabel;
  referralCount: number;
  recentInteractions: Interaction[];
  recentFeedback: Feedback[];
};

/** Everything the admin customer page's "AI-derived insight" panel needs, in one call — see
 * src/app/admin/customers/[id]/page.tsx. Kept separate from the page's main Customer query since
 * this is explicitly the computed/inferred side, not the facts query. */
export async function getCustomerInsights(
  customerId: string,
  orderCount: number,
  mostRecentOrderAt: Date | null,
): Promise<CustomerInsights> {
  const [referralCount, recentInteractions, recentFeedback] = await Promise.all([
    prisma.customer.count({ where: { referredByCustomerId: customerId } }),
    prisma.interaction.findMany({ where: { customerId }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.feedback.findMany({ where: { customerId }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  return {
    lifecycle: computeLifecycleLabel(orderCount, mostRecentOrderAt),
    referralCount,
    recentInteractions,
    recentFeedback,
  };
}
