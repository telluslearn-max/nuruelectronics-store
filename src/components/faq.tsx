export type FaqItem = { q: string; a: string };

export const DEFAULT_FAQS: FaqItem[] = [
  {
    q: "Do you deliver outside Nairobi?",
    a: "Yes — we ship countrywide across Kenya. Nairobi orders can arrive the same day; other areas typically take a few days depending on location.",
  },
  {
    q: "Are your products genuine?",
    a: "Every product we sell is 100% genuine and checked before it ships, backed by manufacturer warranty.",
  },
  {
    q: "Can I order without using the website checkout?",
    a: "Yes — every product page has a WhatsApp ordering option if you'd rather message us directly than check out online.",
  },
  {
    q: "Do displayed prices include VAT?",
    a: "Prices shown on the site exclude VAT — it's calculated and added at checkout, in line with Kenyan tax requirements.",
  },
  {
    q: "What if I'm not sure what to buy?",
    a: "Message us on WhatsApp from the Shop page and we'll help you find the right product for your budget and needs.",
  },
];

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 12 8"
      className="h-3 w-3 shrink-0 rotate-0 text-neutral-400 transition-transform duration-200 ease-out group-open:rotate-180"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 1.5 6 6.5 11 1.5" />
    </svg>
  );
}

export function Faq({ items = DEFAULT_FAQS }: { items?: FaqItem[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <div className="divide-y divide-border-subtle border-y border-border-subtle">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {items.map((item) => (
        <details key={item.q} className="group py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
            {item.q}
            <ChevronIcon />
          </summary>
          <p className="mt-3 text-sm text-neutral-500">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
