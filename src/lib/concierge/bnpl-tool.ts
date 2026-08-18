import "server-only";
import {
  ANDROID_BNPL_PLANS,
  APPLE_BNPL_PLANS,
  BNPL_ELIGIBILITY_REQUIREMENTS,
  buildBnplApplicationMessage,
  buildBnplWaitlistMessage,
  getBnplComingSoonBrand,
  getBnplTier,
  resolveBnplPlan,
  type BnplPlanId,
} from "@/lib/bnpl";
import { getProductByHandle } from "@/lib/shopify";

export type BnplExplainerResult =
  | {
      eligible: true;
      planId: BnplPlanId;
      label: string;
      itemPrice: string;
      deposit: string;
      installment: string;
      termCount: number;
      termUnit: "week" | "month";
      totalPayable: string;
      /** The real all-in cost — deposit + every installment. Always state this (not totalPayable
       * alone) when the shopper asks what they'll pay in total; totalPayable excludes the deposit
       * for Apple's formula-tier plans. */
      totalCost: string;
      currencyCode: string;
      requirements: string[];
      /** Text for the concierge to surface as a "Continue on WhatsApp" CTA once the shopper wants to apply. */
      applicationMessage: string;
    }
  | { eligible: false; comingSoonBrand: string; waitlistMessage: string }
  | { eligible: false; comingSoonBrand: null }
  | { eligible: false; needsVariantSelection: true; availableVariants: { id: string; title: string }[] }
  | { error: string };

/** Backs the concierge's `explain_bnpl_plan` tool — reuses the same real math/message-building as the storefront BnplSection, never forks it. */
export async function explainBnplPlan(
  handle: string,
  planId?: BnplPlanId,
  variantId?: string,
): Promise<BnplExplainerResult> {
  const product = await getProductByHandle(handle);
  if (!product) return { error: "Product not found." };

  const tier = getBnplTier(product.tags);
  if (tier === "coming-soon") {
    const brand = getBnplComingSoonBrand(product.tags) ?? product.title;
    return { eligible: false, comingSoonBrand: brand, waitlistMessage: buildBnplWaitlistMessage(product, brand) };
  }
  if (tier === "none") return { eligible: false, comingSoonBrand: null };

  let variant = variantId ? product.variants.find((v) => v.id === variantId) : undefined;
  if (!variant && product.variants.length === 1) variant = product.variants[0];

  if (tier === "lookup" && !variant && product.variants.length > 1) {
    return {
      eligible: false,
      needsVariantSelection: true,
      availableVariants: product.variants.map((v) => ({ id: v.id, title: v.title })),
    };
  }

  const resolvedPlanId: BnplPlanId = planId ?? (tier === "formula" ? "weekly" : "3-month");
  const plan = resolveBnplPlan(product, variant, resolvedPlanId);
  if (!plan) {
    // Lookup-tier brand, but this exact model/storage/RAM has no rate-card row — flatly not
    // eligible, not a waitlist (BNPL isn't "coming" for it, it's simply not covered).
    return { eligible: false, comingSoonBrand: null };
  }

  const price = variant?.price ?? product.priceRange.minVariantPrice;

  return {
    eligible: true,
    planId: plan.planId,
    label: plan.label,
    itemPrice: plan.itemPrice.toFixed(2),
    deposit: plan.deposit.toFixed(2),
    installment: plan.installment.toFixed(2),
    termCount: plan.termCount,
    termUnit: plan.termUnit,
    totalPayable: plan.totalPayable.toFixed(2),
    totalCost: plan.totalCost.toFixed(2),
    currencyCode: price.currencyCode,
    requirements: BNPL_ELIGIBILITY_REQUIREMENTS[plan.tier],
    applicationMessage: buildBnplApplicationMessage(product, price.currencyCode, plan),
  };
}

export const BNPL_PLAN_IDS = [
  ...Object.keys(APPLE_BNPL_PLANS),
  ...Object.keys(ANDROID_BNPL_PLANS),
] as BnplPlanId[];
