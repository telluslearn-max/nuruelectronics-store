export const BNPL_DEPOSIT_RATE = 0.4;
export const BNPL_BALANCE_MARKUP_MULTIPLIER = 1.5;
export const BNPL_TERM_MONTHS = 12;

export type BnplPlan = {
  itemPrice: number;
  deposit: number;
  balance: number;
  totalPayable: number;
  monthlyInstallment: number;
  termMonths: number;
};

export function calculateBnplPlan(itemPrice: number): BnplPlan {
  const deposit = itemPrice * BNPL_DEPOSIT_RATE;
  const balance = itemPrice - deposit;
  const totalPayable = balance * BNPL_BALANCE_MARKUP_MULTIPLIER;
  const monthlyInstallment = totalPayable / BNPL_TERM_MONTHS;
  return {
    itemPrice,
    deposit,
    balance,
    totalPayable,
    monthlyInstallment,
    termMonths: BNPL_TERM_MONTHS,
  };
}
