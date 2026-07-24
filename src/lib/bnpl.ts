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
};

export function calculateBnplPlan(itemPrice: number, planId: BnplPlanId): BnplPlan {
  const config = BNPL_PLANS[planId];
  const deposit = itemPrice * config.depositRate;
  const balance = itemPrice - deposit;
  const totalPayable = balance * BNPL_BALANCE_MARKUP_MULTIPLIER;
  const installment = totalPayable / config.termCount;
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
