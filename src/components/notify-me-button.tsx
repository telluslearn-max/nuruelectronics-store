import { WhatsAppIcon } from "@/components/whatsapp-order-button";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export function NotifyMeButton({
  productTitle,
  className,
}: {
  productTitle: string;
  className?: string;
}) {
  const message = `Hi! Please notify me when ${productTitle} is available.`;
  const href = buildWhatsAppUrl(message);

  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ??
        "inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90"
      }
    >
      <WhatsAppIcon className="h-4 w-4 shrink-0" />
      Notify me
    </a>
  );
}
