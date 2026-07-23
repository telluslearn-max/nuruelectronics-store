import { ecosystemTagForProduct } from "@/lib/collections";

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

/** BNPL is currently offered on Apple-tagged products only. */
export function isBnplEligibleProduct(tags: string[]): boolean {
  return ecosystemTagForProduct(tags) === "apple";
}
