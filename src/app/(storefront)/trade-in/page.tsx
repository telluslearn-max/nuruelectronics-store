import type { Metadata } from "next";
import Link from "next/link";
import { Faq } from "@/components/faq";
import { WhatsAppIcon } from "@/components/whatsapp-order-button";
import { getCategory } from "@/lib/categories";
import { TRADE_IN_CATEGORY_SLUGS } from "@/lib/trade-in";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Trade In Your Old Phone or Device in Kenya",
  description:
    "Trade in your old phone, laptop, or game for credit toward something new at NURU — message us on WhatsApp with the make, model, and condition for a valuation.",
};

const TRADE_IN_FAQS = [
  {
    q: "How do I trade in my old phone or device in Kenya?",
    a: "Message us on WhatsApp with your device's make, model, and condition, and we'll give you a valuation — no need to bring it in first.",
  },
  {
    q: "What can I trade in?",
    a: "Phones, tablets, computers, audio gear, gaming consoles and games, cameras, and more — see the categories above for what we currently accept.",
  },
  {
    q: "Can I trade in a game I already own?",
    a: "Yes — swap a game you already own toward a new one, or trade it for credit. Message us to arrange the swap.",
  },
];

const tradeInCategories = TRADE_IN_CATEGORY_SLUGS.map((slug) => getCategory(slug)).filter(
  (category): category is NonNullable<typeof category> => category !== undefined,
);

export default function TradeInPage() {
  const deviceWhatsappHref = buildWhatsAppUrl("Hi! I'd like to trade in my old device for credit.");
  const gameWhatsappHref = buildWhatsAppUrl("Hi! I'd like to trade in a game.");

  return (
    <div>
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-medium text-accent">Upgrade for less</p>
        <h1 className="mt-2 text-title sm:text-display">Trade in your old device</h1>
        <p className="mt-4 text-neutral-500">
          Get credit toward something new. Message us on WhatsApp with your device&apos;s make and
          model and condition, and we&apos;ll give you a valuation — no need to bring it in first.
        </p>
        {deviceWhatsappHref && (
          <a
            href={deviceWhatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90"
          >
            <WhatsAppIcon className="h-4 w-4 shrink-0" />
            Start a trade-in via WhatsApp
          </a>
        )}
      </div>

      <div className="mx-auto mt-16 max-w-3xl">
        <h2 className="text-center text-title">What we accept</h2>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {tradeInCategories.map((category) => (
            <Link
              key={category.slug}
              href={`/category/${category.slug}`}
              className="rounded-card border border-border-subtle p-5 text-center transition hover:border-foreground"
            >
              <span className="font-medium">{category.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-2xl rounded-card bg-neutral-50 p-8 text-center">
        <h2 className="text-lg font-semibold">Trading in a game?</h2>
        <p className="mt-2 text-sm text-neutral-500">
          Swap a game you already own toward a new one, or trade it for credit. Browse our{" "}
          <Link href="/category/gaming" className="font-medium text-accent hover:opacity-80">
            gaming section
          </Link>
          , then message us to arrange the swap.
        </p>
        {gameWhatsappHref && (
          <a
            href={gameWhatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-border-subtle px-5 py-2.5 text-sm font-medium transition hover:border-foreground"
          >
            <WhatsAppIcon className="h-4 w-4 shrink-0 text-whatsapp" />
            Trade in a game
          </a>
        )}
      </div>

      <div className="mx-auto mt-16 max-w-2xl">
        <h2 className="mb-4 text-center text-lg font-semibold">Common questions</h2>
        <Faq items={TRADE_IN_FAQS} />
      </div>
    </div>
  );
}
