import { WhatsAppIcon } from "@/components/whatsapp-order-button";
import { isTradeInEligibleProduct } from "@/lib/trade-in";
import { buildWhatsAppUrl, productUrl } from "@/lib/whatsapp";

export function TradeInSection({
  productType,
  productTitle,
  productHandle,
}: {
  productType: string;
  productTitle: string;
  productHandle: string;
}) {
  if (!isTradeInEligibleProduct(productType)) return null;

  const message = `Hi! I'd like to trade in my old device for credit toward ${productTitle}. ${productUrl(productHandle)}`;
  const href = buildWhatsAppUrl(message);

  return (
    <div className="mt-4 rounded-card border border-border-subtle p-4">
      <h3 className="text-sm font-medium">Trade-In</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Trade in your old device for credit toward this one &mdash; we&apos;ll value it over WhatsApp.
      </p>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-control border border-border-subtle px-4 py-2.5 text-sm font-medium transition hover:border-foreground"
        >
          <WhatsAppIcon className="h-4 w-4 shrink-0 text-whatsapp" />
          Start trade-in via WhatsApp
        </a>
      )}
    </div>
  );
}
