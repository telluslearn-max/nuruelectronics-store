import { isTradeInEligibleProduct } from "@/lib/trade-in";

export function TradeInSection({ productType }: { productType: string }) {
  if (!isTradeInEligibleProduct(productType)) return null;

  return (
    <div className="mt-4 rounded-card border border-border-subtle p-4">
      <p className="text-sm font-medium">Trade-In</p>
      <p className="mt-1 text-xs text-neutral-500">
        Trade in your old device for credit toward this one &mdash; coming soon.
      </p>
    </div>
  );
}
