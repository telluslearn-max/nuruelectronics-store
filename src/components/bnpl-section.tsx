"use client";

import { useState } from "react";
import {
  BNPL_PLANS,
  calculateBnplPlan,
  getBnplComingSoonBrand,
  isBnplComingSoonProduct,
  isBnplEligibleProduct,
  type BnplPlanId,
} from "@/lib/bnpl";
import { formatPrice } from "@/lib/format";
import type { Money, Product } from "@/lib/shopify/types";
import { buildWhatsAppUrl, productUrl } from "@/lib/whatsapp";

const ELIGIBILITY_REQUIREMENTS = [
  "A valid national ID",
  "3 months of M-Pesa statements",
  "Must be 18 years or older",
];

export function BnplSection({ product, price }: { product: Product; price: Money }) {
  const [planId, setPlanId] = useState<BnplPlanId>("weekly");

  if (!isBnplEligibleProduct(product.tags)) {
    if (isBnplComingSoonProduct(product.tags)) {
      const brand = getBnplComingSoonBrand(product.tags) ?? product.title;
      const waitlistMessage = `Hi! I'd like to join the waitlist for BNPL on ${brand}. Please notify me when it's available.\n${productUrl(product.handle)}`;
      const waitlistHref = buildWhatsAppUrl(waitlistMessage);
      return (
        <div className="mt-4 rounded-card border border-border-subtle p-4">
          <p className="text-sm font-medium">Buy Now, Pay Later</p>
          <p className="mt-1 text-xs text-neutral-500">Coming soon for this brand.</p>
          {waitlistHref && (
            <a
              href={waitlistHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-control border border-border-subtle px-6 py-3 text-sm font-medium text-[#25D366] transition hover:border-foreground"
            >
              Notify me on WhatsApp
            </a>
          )}
        </div>
      );
    }
    return null;
  }

  const plan = calculateBnplPlan(Number(price.amount), planId);
  const fmt = (amount: number) => formatPrice(String(amount), price.currencyCode);
  const termLabel = `${plan.termCount} ${plan.termUnit}${plan.termCount === 1 ? "" : "s"}`;
  const installmentLabel = plan.termUnit === "week" ? "Weekly payment" : "Monthly payment";

  const message = `Hi! I'd like to apply for BNPL on ${product.title} - ${fmt(plan.itemPrice)}.\nPlan: ${plan.label}, ${termLabel}\nDeposit: ${fmt(plan.deposit)}\n${installmentLabel}: ${fmt(plan.installment)}\n\nI understand I need to provide: a valid ID, 3 months of M-Pesa statements, and confirm I'm 18+.\n${productUrl(product.handle)}`;
  const whatsappHref = buildWhatsAppUrl(message);

  return (
    <div className="mt-4 rounded-card border border-border-subtle p-4">
      <p className="text-sm font-medium">Buy Now, Pay Later</p>
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

      <p className="mt-3 text-sm text-neutral-600">
        <span className="font-medium text-neutral-800">{fmt(plan.deposit)} deposit</span>, then{" "}
        {plan.termCount} x{" "}
        <span className="font-medium text-neutral-800">
          {fmt(plan.installment)}/{plan.termUnit}
        </span>
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        Total payable: {fmt(plan.totalPayable)} (includes interest on balance after deposit)
      </p>

      <ul className="mt-3 space-y-1 text-xs text-neutral-500">
        {ELIGIBILITY_REQUIREMENTS.map((requirement) => (
          <li key={requirement}>&bull; {requirement}</li>
        ))}
      </ul>

      {whatsappHref && (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-control border border-border-subtle px-6 py-3 text-sm font-medium text-[#25D366] transition hover:border-foreground"
        >
          Apply for BNPL via WhatsApp
        </a>
      )}
    </div>
  );
}
