import { SITE_URL } from "@/lib/site";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.5 14.4c-.3-.1-1.7-.8-1.9-.9-.3-.1-.5-.1-.6.1-.2.3-.7.9-.9 1-.2.2-.3.2-.6.1-.9-.4-1.8-1-2.6-1.8-.7-.7-1.3-1.5-1.7-2.3-.1-.2 0-.4.1-.5.2-.2.5-.6.6-.8.1-.2.1-.4 0-.6-.1-.2-.6-1.4-.8-1.9-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.3 0 1.4.9 2.7 1.1 2.9.1.2 1.8 2.8 4.5 3.9 2.2.9 2.9.7 3.4.6.6-.1 1.7-.7 2-1.4.3-.7.3-1.2.2-1.4-.1-.1-.3-.2-.5-.3z" />
      <path d="M12 2C6.5 2 2 6.5 2 12c0 1.9.5 3.7 1.5 5.2L2 22l4.9-1.5C8.4 21.5 10.2 22 12 22c5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18c-1.6 0-3.2-.4-4.5-1.3l-.3-.2-3 1 1-2.9-.2-.3C4.1 15.1 3.6 13.6 3.6 12c0-4.6 3.8-8.4 8.4-8.4s8.4 3.8 8.4 8.4-3.8 8.4-8.4 8.4z" />
    </svg>
  );
}

export function WhatsAppOrderButton({
  productTitle,
  variantLabel,
  price,
  productHandle,
  bnpl,
  compact = false,
}: {
  productTitle: string;
  variantLabel?: string;
  price: string;
  productHandle: string;
  bnpl?: { depositFormatted: string; monthlyFormatted: string; termMonths: number };
  compact?: boolean;
}) {
  if (!WHATSAPP_NUMBER) return null;

  const productUrl = `${SITE_URL}/products/${productHandle}`;
  const bnplText = bnpl
    ? ` I'd like to ask about the BNPL option: ${bnpl.depositFormatted} deposit + ${bnpl.termMonths} x ${bnpl.monthlyFormatted}/month.`
    : "";
  const message = `Hi! I'd like to order ${productTitle}${variantLabel ? ` (${variantLabel})` : ""} - ${price}.${bnplText} ${productUrl}`;
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        compact
          ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-border-subtle text-[#25D366] transition hover:border-foreground"
          : "flex w-full items-center justify-center gap-2 rounded-control border border-border-subtle px-6 py-3.5 text-sm font-medium transition hover:border-foreground"
      }
      aria-label="Order via WhatsApp"
    >
      <WhatsAppIcon className="h-5 w-5 shrink-0 text-[#25D366]" />
      {!compact && "Order via WhatsApp"}
    </a>
  );
}
