"use client";

import { useState } from "react";
import { WhatsAppIcon } from "@/components/whatsapp-order-button";
import { buildWhatsAppUrl, productUrl } from "@/lib/whatsapp";

const TRADE_OPTIONS = [
  { key: "new", label: "New game" },
  { key: "used", label: "Used game" },
  { key: "credit", label: "Cash or credit" },
] as const;

type TradeOptionKey = (typeof TRADE_OPTIONS)[number]["key"];

/**
 * Games are traded in for another game or credit, not a device-purchase
 * discount, so this is deliberately separate from the generic
 * TradeInSection — same "hand off to WhatsApp" pattern as the rest of the
 * site uses for anything that needs a human, not an automated valuation
 * engine we don't have.
 */
export function GameTradeIn({ productTitle, productHandle }: { productTitle: string; productHandle: string }) {
  const [selected, setSelected] = useState<TradeOptionKey>("new");

  const option = TRADE_OPTIONS.find((o) => o.key === selected)!;
  const message = `Hi! I'd like to trade in a game toward ${productTitle}, in exchange for: ${option.label}. ${productUrl(productHandle)}`;
  const href = buildWhatsAppUrl(message);

  if (!href) return null;

  return (
    <div className="mt-4 rounded-card border border-border-subtle p-4">
      <p className="text-sm font-medium">Trade-In</p>
      <p className="mt-1 text-xs text-neutral-500">
        Swap a game you already own toward this one &mdash; choose what you want back.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {TRADE_OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => setSelected(o.key)}
            className={`rounded-control border px-3 py-1.5 text-xs font-medium transition ${
              selected === o.key
                ? "border-foreground bg-foreground text-background"
                : "border-border-subtle hover:border-foreground"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-control border border-border-subtle px-4 py-2.5 text-sm font-medium transition hover:border-foreground"
      >
        <WhatsAppIcon className="h-4 w-4 shrink-0 text-whatsapp" />
        Start trade-in via WhatsApp
      </a>
    </div>
  );
}
