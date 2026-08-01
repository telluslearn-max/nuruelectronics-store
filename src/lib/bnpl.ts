import { formatPrice } from "./format";
import { matchWuezeshaRate } from "./bnpl-rates";
import type { Product, ProductVariant } from "./shopify/types";
import { productUrl } from "./whatsapp";

export type BnplTier = "formula" | "lookup";
export type BnplPlanId = "weekly" | "monthly" | "3-month" | "6-month";

type FormulaPlanConfig = {
  id: "weekly" | "monthly";
  label: string;
  depositRate: number;
  termCount: number;
  termUnit: "week" | "month";
};

type LookupPlanConfig = {
  id: "3-month" | "6-month";
  label: string;
  termCount: 3 | 6;
  termUnit: "month";
};

export const BNPL_BALANCE_MARKUP_MULTIPLIER = 1.5;

/** Apple's plan structure — a generic deposit % + 1.5x markup formula applied to any item price. */
export const APPLE_BNPL_PLANS: Record<"weekly" | "monthly", FormulaPlanConfig> = {
  weekly: { id: "weekly", label: "Weekly", depositRate: 0.4, termCount: 12, termUnit: "week" },
  monthly: { id: "monthly", label: "Monthly", depositRate: 0.5, termCount: 3, termUnit: "month" },
};

/** Android brands' plan structure — term lengths only; the actual figures come from a fixed rate-card lookup, not a formula. */
export const ANDROID_BNPL_PLANS: Record<"3-month" | "6-month", LookupPlanConfig> = {
  "3-month": { id: "3-month", label: "3 Months", termCount: 3, termUnit: "month" },
  "6-month": { id: "6-month", label: "6 Months", termCount: 6, termUnit: "month" },
};

export type BnplPlan = {
  planId: BnplPlanId;
  tier: BnplTier;
  label: string;
  itemPrice: number;
  deposit: number;
  balance: number;
  totalPayable: number;
  installment: number;
  termCount: number;
  termUnit: "week" | "month";
  /** Percentage the balance is marked up by. Only meaningful for the formula tier — a lookup-tier
   * rate card doesn't state an interest rate, so we don't back-calculate or display one. */
  effectiveRatePercent?: number;
  /** Audit trail back to the exact rate-card row used, for the lookup tier only. */
  sourceRateRowId?: string;
};

export function calculateFormulaBnplPlan(itemPrice: number, planId: "weekly" | "monthly"): BnplPlan {
  const config = APPLE_BNPL_PLANS[planId];
  const deposit = itemPrice * config.depositRate;
  const balance = itemPrice - deposit;
  const totalPayable = balance * BNPL_BALANCE_MARKUP_MULTIPLIER;
  const installment = totalPayable / config.termCount;
  const effectiveRatePercent = ((totalPayable - balance) / balance) * 100;
  return {
    planId,
    tier: "formula",
    label: config.label,
    itemPrice,
    deposit,
    balance,
    totalPayable,
    installment,
    termCount: config.termCount,
    termUnit: config.termUnit,
    effectiveRatePercent,
  };
}

export function lookupAndroidBnplPlan(
  product: Product,
  variant: ProductVariant | undefined,
  planId: "3-month" | "6-month",
): BnplPlan | null {
  const result = matchWuezeshaRate(product, variant);
  if (!result.matched) return null;
  const { row } = result;
  const config = ANDROID_BNPL_PLANS[planId];
  const installment = planId === "3-month" ? row.installment3moKes : row.installment6moKes;
  const totalPayable = row.depositKes + installment * config.termCount;
  return {
    planId,
    tier: "lookup",
    label: config.label,
    itemPrice: Number((variant?.price ?? product.priceRange.minVariantPrice).amount),
    deposit: row.depositKes,
    balance: totalPayable - row.depositKes,
    totalPayable,
    installment,
    termCount: config.termCount,
    termUnit: config.termUnit,
    sourceRateRowId: row.id,
  };
}

/** Single dispatch seam — the one place that knows which brands are formula-tier vs lookup-tier. */
export function resolveBnplPlan(
  product: Product,
  variant: ProductVariant | undefined,
  planId: BnplPlanId,
): BnplPlan | null {
  const tier = getBnplTier(product.tags);
  if (tier === "formula") return calculateFormulaBnplPlan(Number((variant?.price ?? product.priceRange.minVariantPrice).amount), planId as "weekly" | "monthly");
  if (tier === "lookup") return lookupAndroidBnplPlan(product, variant, planId as "3-month" | "6-month");
  return null;
}

/** Brand tags on the generic 1.5x-markup formula. */
export const BNPL_FORMULA_BRAND_TAGS = ["apple"];

/** Brand tags priced via the fixed partner rate-card lookup. */
export const BNPL_LOOKUP_BRAND_TAGS = ["samsung", "google", "oneplus", "nothing"];

/** Brand tags BNPL is planned for but not yet live. */
export const BNPL_COMING_SOON_BRAND_TAGS = ["infinix", "oppo", "tecno", "vivo", "xiaomi"];

export function getBnplTier(tags: string[]): BnplTier | "coming-soon" | "none" {
  if (tags.some((tag) => BNPL_FORMULA_BRAND_TAGS.includes(tag))) return "formula";
  if (tags.some((tag) => BNPL_LOOKUP_BRAND_TAGS.includes(tag))) return "lookup";
  if (tags.some((tag) => BNPL_COMING_SOON_BRAND_TAGS.includes(tag))) return "coming-soon";
  return "none";
}

/** Human-readable brand name for a coming-soon product's matched tag, if any. */
export function getBnplComingSoonBrand(tags: string[]): string | undefined {
  const tag = BNPL_COMING_SOON_BRAND_TAGS.find((t) => tags.includes(t));
  return tag ? tag.charAt(0).toUpperCase() + tag.slice(1) : undefined;
}

export const BNPL_ELIGIBILITY_REQUIREMENTS: Record<BnplTier, string[]> = {
  formula: ["A valid national ID", "3 months of M-Pesa statements", "Must be 18 years or older"],
  lookup: [
    "National ID (front and back)",
    "A recent selfie",
    "Your employer or business name",
    "One guarantor with a valid Safaricom number",
  ],
};

/**
 * The single source of truth for the BNPL WhatsApp application message — used by both the
 * storefront BnplSection and the AI concierge's BNPL tool, so the two never drift apart.
 */
export function buildBnplApplicationMessage(
  product: { title: string; handle: string },
  currencyCode: string,
  plan: BnplPlan,
): string {
  const fmt = (amount: number) => formatPrice(String(amount), currencyCode);
  const termLabel = `${plan.termCount} ${plan.termUnit}${plan.termCount === 1 ? "" : "s"}`;
  const installmentLabel = plan.termUnit === "week" ? "Weekly payment" : "Monthly payment";
  const requirements = BNPL_ELIGIBILITY_REQUIREMENTS[plan.tier].join(", ");
  return `Hi! I'd like to apply for BNPL on ${product.title} - ${fmt(plan.itemPrice)}.\nPlan: ${plan.label}, ${termLabel}\nDeposit: ${fmt(plan.deposit)}\n${installmentLabel}: ${fmt(plan.installment)}\n\nI understand I need to provide: ${requirements}.\n${productUrl(product.handle)}`;
}

/** Mirrors buildBnplApplicationMessage's waitlist copy in BnplSection, for a brand/model BNPL isn't live on yet. */
export function buildBnplWaitlistMessage(product: { title: string; handle: string }, brand: string): string {
  return `Hi! I'd like to join the waitlist for BNPL on ${brand}. Please notify me when it's available.\n${productUrl(product.handle)}`;
}
