import type { Metadata } from "next";
import Link from "next/link";
import { WhatsAppIcon } from "@/components/whatsapp-order-button";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Returns",
  description: "How to start a return, refund, or warranty claim at NURU.",
};

const STEPS = [
  {
    title: "Message us first",
    body: "Contact us on WhatsApp within 7 days of delivery, before sending anything back, so we can confirm eligibility.",
  },
  {
    title: "Keep it in original condition",
    body: "The item needs to be unused, in its original packaging, with all accessories included.",
  },
  {
    title: "Damaged, wrong, or missing items",
    body: "Contact us within 48 hours of delivery with photos of the item and packaging, and we'll replace, repair, or refund it once verified.",
  },
  {
    title: "Getting your refund",
    body: "Refunds are issued back the way you paid — through Shopify for card/checkout orders, or by M-Pesa/cash for orders paid that way.",
  },
  {
    title: "BNPL orders",
    body: "We handle the return of the product itself. Your deposit, installments, and credit agreement are with our BNPL partner, not NURU.",
  },
];

export default function ReturnsPage() {
  const whatsappHref = buildWhatsAppUrl("Hi! I'd like to start a return for order #___.");

  return (
    <div className="mx-auto max-w-2xl">
      <div className="text-center">
        <p className="text-sm font-medium text-accent">Need to send something back?</p>
        <h1 className="mt-2 text-title sm:text-display">Start a return</h1>
        <p className="mt-4 text-neutral-500">
          Here&apos;s how returns work at NURU. For the full legal terms, see our{" "}
          <Link href="/legal/refund-policy" className="underline underline-offset-2">
            Refund &amp; Warranty Policy
          </Link>
          .
        </p>
      </div>

      <ol className="mt-12 space-y-6">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent">
              {index + 1}
            </span>
            <div>
              <p className="font-medium">{step.title}</p>
              <p className="mt-1 text-sm text-neutral-500">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      {whatsappHref && (
        <div className="mt-12 rounded-card bg-neutral-50 p-8 text-center">
          <h2 className="text-lg font-semibold">Ready to start?</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Message us with your order number and we&apos;ll take it from there.
          </p>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90"
          >
            <WhatsAppIcon className="h-4 w-4 shrink-0" />
            Start a return via WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}
