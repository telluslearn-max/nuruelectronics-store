import type { Metadata } from "next";
import Link from "next/link";
import { WhatsAppIcon } from "@/components/whatsapp-order-button";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Gift Cards",
  description: "Digital gift cards, delivered fast, at NURU.",
};

export default function GiftCardsPage() {
  const whatsappHref = buildWhatsAppUrl("Hi! I have a question about gift cards.");

  return (
    <div>
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-medium text-accent">Digital delivery</p>
        <h1 className="mt-2 text-title sm:text-display">Gift Cards</h1>
        <p className="mt-4 text-neutral-500">
          Digital gift cards for the platforms and stores you already use. No wrapping, no
          shipping — just a code, sent straight to you.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {[
            { slug: "playstation", label: "PlayStation" },
            { slug: "xbox", label: "Xbox" },
            { slug: "nintendo", label: "Nintendo" },
          ].map((category) => (
            <Link
              key={category.slug}
              href={`/gift-cards/${category.slug}`}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90"
            >
              {category.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-16 grid max-w-3xl gap-6 sm:grid-cols-2">
        <div className="rounded-card border border-border-subtle p-6">
          <h2 className="font-semibold">Instant delivery</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Pay via M-Pesa and your code is sourced and sent automatically — by email and WhatsApp — no
            waiting on a human. No shipping needed either, since it&apos;s a digital code.
          </p>
        </div>
        <div className="rounded-card border border-border-subtle p-6">
          <h2 className="font-semibold">Check the region first</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Some gift cards only redeem on an account registered to a specific region (e.g. a US
            store card needs a US account). Each card&apos;s page lists its region — check it
            before ordering.
          </p>
        </div>
      </div>

      {whatsappHref && (
        <div className="mx-auto mt-16 max-w-2xl rounded-card bg-neutral-50 p-8 text-center">
          <h2 className="text-lg font-semibold">Not sure which one you need?</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Message us on WhatsApp and we&apos;ll help you find the right card.
          </p>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-border-subtle px-5 py-2.5 text-sm font-medium transition hover:border-foreground"
          >
            <WhatsAppIcon className="h-4 w-4 shrink-0 text-whatsapp" />
            Ask on WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}
