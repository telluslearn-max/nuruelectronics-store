import type { Metadata } from "next";
import { WhatsAppIcon } from "@/components/whatsapp-order-button";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

export const metadata: Metadata = {
  title: "Careers",
  description: "Interested in working with NURU? Here's how to reach us.",
};

export default function CareersPage() {
  const whatsappHref = buildWhatsAppUrl(
    "Hi! I'm interested in opportunities at NURU and wanted to reach out.",
  );

  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-medium text-accent">Careers</p>
      <h1 className="mt-2 text-title sm:text-display">Working at NURU</h1>
      <p className="mt-4 text-neutral-500">
        NURU is a Kenya-based electronics store, and we&apos;re always happy to hear from people
        who want to be part of it. We don&apos;t have any formal openings listed right now, but if
        you think you&apos;d be a good fit, reach out — we read every message.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90"
          >
            <WhatsAppIcon className="h-4 w-4 shrink-0" />
            Message us on WhatsApp
          </a>
        )}
        {SUPPORT_EMAIL && (
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Interested in working at NURU")}`}
            className="inline-flex items-center gap-2 rounded-full border border-border-subtle px-5 py-2.5 text-sm font-medium transition hover:border-foreground"
          >
            Email us
          </a>
        )}
      </div>
    </div>
  );
}
