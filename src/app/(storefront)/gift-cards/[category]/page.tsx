import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { priceOfferingInKes } from "@/lib/gift-card-pricing";
import { formatPrice } from "@/lib/format";

const CATEGORY_LABELS: Record<string, string> = {
  playstation: "PlayStation",
  xbox: "Xbox",
  nintendo: "Nintendo",
  other: "Other",
};

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  const label = CATEGORY_LABELS[category];
  return { title: label ? `${label} Gift Cards` : "Gift Cards" };
}

/** Lowest priced denomination for an offering — used for the "From KES X" teaser on the listing card. */
function cheapestDenomination(offering: { denominationType: string; fixedDenominations: unknown[]; minDenomination: unknown }): number | null {
  if (offering.denominationType === "FIXED") {
    if (offering.fixedDenominations.length === 0) return null;
    return Math.min(...offering.fixedDenominations.map(Number));
  }
  return offering.minDenomination != null ? Number(offering.minDenomination) : null;
}

export default async function GiftCardCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  if (!CATEGORY_LABELS[category]) notFound();

  const [offerings, settings] = await Promise.all([
    prisma.giftCardOffering.findMany({ where: { category, published: true }, orderBy: { displayName: "asc" } }),
    getSettings(),
  ]);

  return (
    <div>
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-medium text-accent">Digital delivery · Pay via M-Pesa</p>
        <h1 className="mt-2 text-title sm:text-display">{CATEGORY_LABELS[category]} Gift Cards</h1>
        <p className="mt-4 text-neutral-500">Pick a card, pay via M-Pesa, and get your code automatically.</p>
      </div>

      <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {offerings.map((offering) => {
          const cheapest = cheapestDenomination(offering);
          let priceFrom: number | null = null;
          if (cheapest != null) {
            try {
              priceFrom = priceOfferingInKes(offering, cheapest, settings);
            } catch {
              priceFrom = null;
            }
          }
          return (
            <Link
              key={offering.id}
              href={`/gift-cards/${category}/${offering.id}`}
              className="rounded-card border border-border-subtle p-5 transition hover:border-foreground"
            >
              <p className="font-medium">{offering.displayName}</p>
              <p className="mt-1 text-sm text-neutral-500">{offering.reloadlyCountryCode}</p>
              {priceFrom != null && <p className="mt-3 text-lg font-semibold">From {formatPrice(priceFrom.toString(), "KES")}</p>}
            </Link>
          );
        })}
        {offerings.length === 0 && (
          <p className="text-neutral-500 sm:col-span-2 lg:col-span-3">
            No {CATEGORY_LABELS[category]} gift cards available right now — check back soon.
          </p>
        )}
      </div>
    </div>
  );
}
