import type { Metadata } from "next";
import { Suspense } from "react";
import { ExUkDiscoverScreen } from "@/components/ex-uk/ex-uk-discover-screen";
import { computeSavings, findCounterpart, type Savings } from "@/lib/product-match";
import { getProducts } from "@/lib/shopify";

export const metadata: Metadata = {
  title: { absolute: "Ex-UK Deals — Unboxed, UK-Imported Phones in Kenya | NURU" },
  description:
    "Genuine ex-UK phones and electronics at a lower price than new, every unit still covered by a 1-year warranty. Browse or swipe through unboxed, UK-imported units on NURU.",
};

// The audit's own recommendation was to add visible FAQ content here, but this route is
// deliberately a full-screen, gesture-driven app shell (swipe deck on mobile, grid on desktop —
// see ex-uk-discover-screen.tsx) with no natural place for a static content block without
// reworking that design. Shipping the FAQPage schema on its own is the safe middle ground; making
// this content visible too belongs with the ex-UK trust/content cluster the audit calls out as a
// separate follow-up (a supporting blog post), not a change to this app shell.
const exUkFaqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is an Ex-UK phone?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "An Ex-UK unit is a genuine, previously-owned phone or device imported from the UK, inspected and graded for condition before it's listed — not a copy or a knockoff. It's sold at a lower price than the equivalent brand-new unit.",
      },
    },
    {
      "@type": "Question",
      name: "Is it safe to buy a refurbished or Ex-UK phone in Kenya?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — every Ex-UK unit on NURU is inspected before listing and comes with a 1-year warranty, the same as many new-device warranties. Condition and battery health are shown on each listing before you buy.",
      },
    },
    {
      "@type": "Question",
      name: "What warranty do Ex-UK units have?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Every Ex-UK unit is covered by a 1-year warranty, regardless of its condition grade.",
      },
    },
    {
      "@type": "Question",
      name: "How much cheaper is an Ex-UK phone than buying new?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Savings vary by model and condition, but Ex-UK units are consistently listed below the equivalent new unit's price — each listing shows the exact savings against the current new price.",
      },
    },
  ],
};

export default async function ExUkPage() {
  const { products } = await getProducts({
    searchTerm: "tag:ex-uk",
    includeSpecs: true,
    first: 50,
    includeExUk: true,
  });

  const savingsEntries = await Promise.all(
    products.map(async (product) => {
      const counterpart = await findCounterpart(product, { requireExUk: false });
      if (!counterpart) return null;
      const savings = computeSavings(
        product.priceRange.minVariantPrice.amount,
        counterpart.priceRange.minVariantPrice.amount,
        product.priceRange.minVariantPrice.currencyCode,
      );
      return savings ? ([product.handle, savings] as const) : null;
    }),
  );
  const savingsByHandle: Record<string, Savings> = Object.fromEntries(
    savingsEntries.filter((entry): entry is readonly [string, Savings] => entry !== null),
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(exUkFaqJsonLd) }}
      />
      <Suspense>
        <ExUkDiscoverScreen products={products} savingsByHandle={savingsByHandle} />
      </Suspense>
    </>
  );
}
