const FAQS = [
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
    q: "What if I'm not sure what to buy?",
    a: "Message us on WhatsApp from the Shop page and we'll help you find the right product for your budget and needs.",
  },
];

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 12 8"
      className="h-3 w-3 shrink-0 text-neutral-400 transition group-open:rotate-180"
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

export function Faq() {
  return (
    <div className="divide-y divide-border-subtle border-y border-border-subtle">
      {FAQS.map((item) => (
        <details key={item.q} className="group py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium marker:content-none">
            {item.q}
            <ChevronIcon />
          </summary>
          <p className="mt-3 text-sm text-neutral-500">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
