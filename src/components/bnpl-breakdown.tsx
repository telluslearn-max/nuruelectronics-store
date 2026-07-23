import { calculateBnplPlan } from "@/lib/bnpl";
import { formatPrice } from "@/lib/format";
import type { Money } from "@/lib/shopify/types";

export function BnplBreakdown({ price, compact = false }: { price: Money; compact?: boolean }) {
  const plan = calculateBnplPlan(Number(price.amount));
  const fmt = (amount: number) => formatPrice(String(amount), price.currencyCode);

  if (compact) {
    return (
      <p className="text-xs text-neutral-500">
        Or from <span className="font-medium text-neutral-700">{fmt(plan.monthlyInstallment)}/mo</span> with BNPL
      </p>
    );
  }

  return (
    <p className="mt-1 text-xs text-neutral-500">
      Or pay in installments: <span className="font-medium text-neutral-700">{fmt(plan.deposit)} deposit</span>,
      then {plan.termMonths} x <span className="font-medium text-neutral-700">{fmt(plan.monthlyInstallment)}/mo</span>
    </p>
  );
}
