"use client";

import { useState } from "react";
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
import { formatPrice } from "@/lib/format";
import type { Money, Product, ProductVariant } from "@/lib/shopify/types";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

function WaitlistPanel({ product, brand, note }: { product: Product; brand: string; note: string }) {
  const waitlistMessage = buildBnplWaitlistMessage(product, brand);
  const waitlistHref = buildWhatsAppUrl(waitlistMessage);
  return (
    <div className="mt-4 rounded-card border border-border-subtle p-4">
      <h3 className="text-sm font-medium">Buy Now, Pay Later</h3>
      <p className="mt-1 text-xs text-neutral-500">{note}</p>
      {waitlistHref && (
        <a
          href={waitlistHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-control border border-border-subtle px-6 py-3 text-sm font-medium text-whatsapp transition hover:border-foreground"
        >
          Ask us on WhatsApp
        </a>
      )}
    </div>
  );
}

export function BnplSection({
  product,
  variant,
  price,
}: {
  product: Product;
  variant: ProductVariant | undefined;
  price: Money;
}) {
  const tier = getBnplTier(product.tags, product.productType);
  const [planId, setPlanId] = useState<BnplPlanId>(tier === "formula" ? "weekly" : "3-month");

  if (tier === "coming-soon") {
    const brand = getBnplComingSoonBrand(product.tags) ?? product.title;
    return <WaitlistPanel product={product} brand={brand} note="Coming soon for this brand." />;
  }
  if (tier === "none") return null;

  const plan = resolveBnplPlan(product, variant, planId);
  if (!plan) {
    // Lookup-tier brand, but this exact model/storage/RAM has no rate-card row — show nothing,
    // rather than a waitlist panel implying BNPL is coming for it.
    return null;
  }

  const fmt = (amount: number) => formatPrice(String(amount), price.currencyCode);
  const message = buildBnplApplicationMessage(product, price.currencyCode, plan);
  const whatsappHref = buildWhatsAppUrl(message);
  const plans = tier === "formula" ? Object.values(APPLE_BNPL_PLANS) : Object.values(ANDROID_BNPL_PLANS);

  return (
    <div className="mt-4 rounded-card border border-border-subtle p-4">
      <h3 className="text-sm font-medium">Buy Now, Pay Later</h3>
      <div className="mt-2 flex gap-2">
        {plans.map((config) => (
          <button
            key={config.id}
            type="button"
            onClick={() => setPlanId(config.id)}
            className={`rounded-card border px-4 py-2 text-sm transition ${
              planId === config.id
                ? "border-foreground bg-foreground text-background"
                : "border-border-subtle hover:border-foreground"
            }`}
          >
            {config.label}
          </button>
        ))}
      </div>

      <p className="mt-3 text-sm text-neutral-600">
        <span className="font-medium text-neutral-800">{fmt(plan.deposit)} deposit</span>, then{" "}
        {plan.termCount} x{" "}
        <span className="font-medium text-neutral-800">
          {fmt(plan.installment)}/{plan.termUnit}
        </span>
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        Installment plan total: {fmt(plan.totalPayable)}
        {plan.effectiveRatePercent !== undefined &&
          ` (includes ${plan.effectiveRatePercent.toFixed(0)}% interest on the balance after deposit)`}
      </p>
      {plan.totalCost !== plan.totalPayable && (
        <p className="mt-1 text-sm font-medium text-neutral-800">
          Total cost (deposit + all installments): {fmt(plan.totalCost)}
        </p>
      )}

      <ul className="mt-3 space-y-1 text-xs text-neutral-500">
        {BNPL_ELIGIBILITY_REQUIREMENTS[plan.tier].map((requirement) => (
          <li key={requirement}>&bull; {requirement}</li>
        ))}
      </ul>

      {whatsappHref && (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-control border border-border-subtle px-6 py-3 text-sm font-medium text-whatsapp transition hover:border-foreground"
        >
          Apply for BNPL via WhatsApp
        </a>
      )}
    </div>
  );
}
