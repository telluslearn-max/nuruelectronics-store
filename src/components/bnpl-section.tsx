"use client";

import { useState } from "react";
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
import { formatPrice } from "@/lib/format";
import type { Money, Product, ProductVariant } from "@/lib/shopify/types";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export function BnplSection({
  product,
  price,
  bnplOverride,
}: {
  product: Product;
  price: Money;
  bnplOverride?: ProductVariant["bnplOverride"];
}) {
  const [planId, setPlanId] = useState<BnplPlanId>("weekly");
  const [expanded, setExpanded] = useState(false);

  if (!isBnplEligibleProduct(product.tags)) {
    if (isBnplComingSoonProduct(product.tags)) {
      const brand = getBnplComingSoonBrand(product.tags) ?? product.title;
      const waitlistMessage = buildBnplWaitlistMessage(product, brand);
      const waitlistHref = buildWhatsAppUrl(waitlistMessage);
      return (
        <div className="mt-4 rounded-card border border-border-subtle p-4">
          <h3 className="text-sm font-medium">Buy Now, Pay Later</h3>
          <p className="mt-1 text-xs text-neutral-500">Coming soon for this brand.</p>
          {waitlistHref && (
            <a
              href={waitlistHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-control border border-border-subtle px-6 py-3 text-sm font-medium text-whatsapp transition hover:border-foreground"
            >
              Notify me on WhatsApp
            </a>
          )}
        </div>
      );
    }
    return null;
  }

  const plan = bnplOverride
    ? buildPartnerBnplPlan(Number(price.amount), {
        deposit: Number(bnplOverride.deposit.amount),
        installment: Number(bnplOverride.installment.amount),
        termCount: bnplOverride.termCount,
        termUnit: bnplOverride.termUnit,
        processingFee: bnplOverride.processingFee ? Number(bnplOverride.processingFee.amount) : undefined,
        insurancePerPeriod: bnplOverride.insurancePerPeriod
          ? Number(bnplOverride.insurancePerPeriod.amount)
          : undefined,
        referencePrice: bnplOverride.referencePrice ? Number(bnplOverride.referencePrice.amount) : undefined,
      })
    : calculateBnplPlan(Number(price.amount), planId);
  const fmt = (amount: number) => formatPrice(String(amount), price.currencyCode);

  const message = buildBnplApplicationMessage(product, price.currencyCode, plan);
  const whatsappHref = buildWhatsAppUrl(message);

  if (!expanded) {
    return (
      <div className="mt-4 rounded-card border border-border-subtle p-4">
        <h3 className="text-sm font-medium">Buy Now, Pay Later</h3>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-control border border-foreground px-6 py-3 text-sm font-medium transition hover:bg-foreground hover:text-background"
        >
          Buy with BNPL
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-card border border-border-subtle p-4">
      <h3 className="text-sm font-medium">Buy Now, Pay Later</h3>
      {/* Wuezesha's partner-supplied figures are a single fixed plan — no weekly/monthly choice. */}
      {!bnplOverride && (
        <div className="mt-2 flex gap-2">
          {Object.values(BNPL_PLANS).map((config) => (
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
      )}

      {plan.referencePrice !== undefined && (
        <p className="mt-3 text-sm text-neutral-600">
          Wuezesha price: <span className="font-medium text-neutral-800">{fmt(plan.referencePrice)}</span>
        </p>
      )}
      <p className={plan.referencePrice !== undefined ? "mt-1 text-sm text-neutral-600" : "mt-3 text-sm text-neutral-600"}>
        <span className="font-medium text-neutral-800">{fmt(plan.deposit)} deposit</span>, then{" "}
        {plan.termCount} x{" "}
        <span className="font-medium text-neutral-800">
          {fmt(plan.installment)}/{plan.termUnit}
        </span>
      </p>
      {plan.processingFee !== undefined && (
        // No percentage shown here deliberately — the deposit rate is set by Wuezesha against
        // their own reference price, not our itemPrice, so a derived "(X%)" here would show a
        // different number than what Wuezesha's own disclosure states.
        <p className="mt-1 text-xs text-neutral-500">
          Deposit {fmt(plan.deposit - plan.processingFee)} + processing fee {fmt(plan.processingFee)}
        </p>
      )}
      {plan.insurancePerPeriod !== undefined && (
        <p className="mt-1 text-xs text-neutral-500">
          Includes {fmt(plan.insurancePerPeriod)} insurance per {plan.termUnit}
        </p>
      )}
      <p className="mt-1 text-xs text-neutral-500">
        {plan.effectiveRatePercent !== undefined ? (
          <>
            Total payable: {fmt(plan.totalPayable)} (includes {plan.effectiveRatePercent.toFixed(0)}% interest
            on the balance after deposit)
          </>
        ) : (
          <>Total payable: {fmt(plan.totalPayable)}</>
        )}
      </p>

      <ul className="mt-3 space-y-1 text-xs text-neutral-500">
        {BNPL_ELIGIBILITY_REQUIREMENTS.map((requirement) => (
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
