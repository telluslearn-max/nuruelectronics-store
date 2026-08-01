import type { Metadata } from "next";
import { WhatsAppIcon } from "@/components/whatsapp-order-button";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "We'll be right back",
  description: "NURU is temporarily down for maintenance. We'll be back shortly.",
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  const whatsappHref = buildWhatsAppUrl("Hi! I have a question — I saw the site is under maintenance.");

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-lg font-semibold tracking-tight">NURU</p>
      <h1 className="mt-6 text-title sm:text-display">We&apos;ll be right back</h1>
      <p className="mt-4 max-w-md text-neutral-500">
        We&apos;re making some improvements and will be back online shortly. Thanks for your
        patience.
      </p>
      {whatsappHref && (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90"
        >
          <WhatsAppIcon className="h-4 w-4 shrink-0" />
          Message us on WhatsApp
        </a>
      )}
    </div>
  );
}
