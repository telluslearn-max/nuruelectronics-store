import { formatPrice } from "./format";
import { productUrl } from "./whatsapp";

export type BnplPlanId = "weekly" | "monthly";

type BnplPlanConfig = {
  id: BnplPlanId;
  label: string;
  depositRate: number;
  termCount: number;
  termUnit: "week" | "month";
};

export const BNPL_BALANCE_MARKUP_MULTIPLIER = 1.5;

export const BNPL_PLANS: Record<BnplPlanId, BnplPlanConfig> = {
  weekly: { id: "weekly", label: "Weekly", depositRate: 0.4, termCount: 12, termUnit: "week" },
  monthly: { id: "monthly", label: "Monthly", depositRate: 0.5, termCount: 3, termUnit: "month" },
};

export type BnplPlan = {
  planId: BnplPlanId;
  label: string;
  itemPrice: number;
  deposit: number;
  balance: number;
  totalPayable: number;
  installment: number;
  termCount: number;
  termUnit: "week" | "month";
  /** Percentage the balance is marked up by, e.g. 50 for a 1.5x multiplier. */
  effectiveRatePercent: number;
};

export function calculateBnplPlan(itemPrice: number, planId: BnplPlanId): BnplPlan {
  const config = BNPL_PLANS[planId];
  const deposit = itemPrice * config.depositRate;
  const balance = itemPrice - deposit;
  const totalPayable = balance * BNPL_BALANCE_MARKUP_MULTIPLIER;
  const installment = totalPayable / config.termCount;
  const effectiveRatePercent = ((totalPayable - balance) / balance) * 100;
  return {
    planId,
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

/** Brand tags BNPL is currently live for. */
export const BNPL_LIVE_BRAND_TAGS = ["apple"];

/** Brand tags BNPL is planned for but not yet live. */
export const BNPL_COMING_SOON_BRAND_TAGS = ["infinix", "oppo", "samsung", "tecno", "vivo", "xiaomi"];

export function isBnplEligibleProduct(tags: string[]): boolean {
  return tags.some((tag) => BNPL_LIVE_BRAND_TAGS.includes(tag));
}

export function isBnplComingSoonProduct(tags: string[]): boolean {
  return tags.some((tag) => BNPL_COMING_SOON_BRAND_TAGS.includes(tag));
}

/** Human-readable brand name for a coming-soon product's matched tag, if any. */
export function getBnplComingSoonBrand(tags: string[]): string | undefined {
  const tag = BNPL_COMING_SOON_BRAND_TAGS.find((t) => tags.includes(t));
  return tag ? tag.charAt(0).toUpperCase() + tag.slice(1) : undefined;
}

export const BNPL_ELIGIBILITY_REQUIREMENTS = [
  "A valid national ID",
  "3 months of M-Pesa statements",
  "Must be 18 years or older",
];

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
  return `Hi! I'd like to apply for BNPL on ${product.title} - ${fmt(plan.itemPrice)}.\nPlan: ${plan.label}, ${termLabel}\nDeposit: ${fmt(plan.deposit)}\n${installmentLabel}: ${fmt(plan.installment)}\n\nI understand I need to provide: a valid ID, 3 months of M-Pesa statements, and confirm I'm 18+.\n${productUrl(product.handle)}`;
}

/** Mirrors buildBnplApplicationMessage's waitlist copy in BnplSection, for a brand BNPL isn't live on yet. */
export function buildBnplWaitlistMessage(product: { title: string; handle: string }, brand: string): string {
  return `Hi! I'd like to join the waitlist for BNPL on ${brand}. Please notify me when it's available.\n${productUrl(product.handle)}`;
}
