import { WhatsAppIcon } from "@/components/whatsapp-order-button";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

export function ConciergeWhatsAppCta({ message }: { message: string }) {
  if (!WHATSAPP_NUMBER) return null;

  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex w-full items-center justify-center gap-2 rounded-control border border-border-subtle px-4 py-2.5 text-sm font-medium transition hover:border-foreground"
    >
      <WhatsAppIcon className="h-4 w-4 shrink-0 text-[#25D366]" />
      Continue on WhatsApp
    </a>
  );
}
