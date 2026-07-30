import "server-only";
import {
  BNPL_ELIGIBILITY_REQUIREMENTS,
  BNPL_PLANS,
  buildBnplApplicationMessage,
  buildBnplWaitlistMessage,
  buildPartnerBnplPlan,
  calculateBnplPlan,
  getBnplComingSoonBrand,
  isBnplComingSoonProduct,
  isBnplEligibleProduct,
  type BnplPlanId,
} from "@/lib/bnpl";
import { getProductByHandle } from "@/lib/shopify";

export type BnplExplainerResult =
  | {
      eligible: true;
      planId: BnplPlanId | "partner";
      label: string;
      itemPrice: string;
      deposit: string;
      installment: string;
      termCount: number;
      termUnit: "week" | "month";
      totalPayable: string;
      currencyCode: string;
      requirements: string[];
      /** Text for the concierge to surface as a "Continue on WhatsApp" CTA once the shopper wants to apply. */
      applicationMessage: string;
    }
  | { eligible: false; comingSoonBrand: string; waitlistMessage: string }
  | { eligible: false; comingSoonBrand: null }
  | { error: string };

/** Backs the concierge's `explain_bnpl_plan` tool — reuses the same real math/message-building as the storefront BnplSection, never forks it. */
export async function explainBnplPlan(handle: string, planId: BnplPlanId = "weekly"): Promise<BnplExplainerResult> {
  const product = await getProductByHandle(handle);
  if (!product) return { error: "Product not found." };

  if (!isBnplEligibleProduct(product.tags)) {
    if (isBnplComingSoonProduct(product.tags)) {
      const brand = getBnplComingSoonBrand(product.tags) ?? product.title;
      return { eligible: false, comingSoonBrand: brand, waitlistMessage: buildBnplWaitlistMessage(product, brand) };
    }
    return { eligible: false, comingSoonBrand: null };
  }

  const price = product.priceRange.minVariantPrice;
  const cheapestVariant = product.variants.find((v) => v.price.amount === price.amount);
  const bnplOverride = cheapestVariant?.bnplOverride;
  // A partner-supplied plan (Wuezesha) is a single fixed plan — the requested planId doesn't apply.
  const plan = bnplOverride
    ? buildPartnerBnplPlan(Number(price.amount), {
        deposit: Number(bnplOverride.deposit.amount),
        installment: Number(bnplOverride.installment.amount),
        termCount: bnplOverride.termCount,
        termUnit: bnplOverride.termUnit,
      })
    : calculateBnplPlan(Number(price.amount), planId);

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
    currencyCode: price.currencyCode,
    requirements: BNPL_ELIGIBILITY_REQUIREMENTS,
    applicationMessage: buildBnplApplicationMessage(product, price.currencyCode, plan),
  };
}

export const BNPL_PLAN_IDS = Object.keys(BNPL_PLANS) as BnplPlanId[];
