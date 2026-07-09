import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CollectionPage } from "@/components/collection-page";
import { getEcosystem } from "@/lib/collections";
import { getProducts } from "@/lib/shopify";

type EcosystemPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string }>;
};

function buildHref(slug: string, sort?: string) {
  const params = new URLSearchParams();
  if (sort) params.set("sort", sort);
  const qs = params.toString();
  return `/ecosystem/${slug}${qs ? `?${qs}` : ""}`;
}

export async function generateMetadata({ params }: EcosystemPageProps): Promise<Metadata> {
  const { slug } = await params;
  const ecosystem = getEcosystem(slug);
  if (!ecosystem) return {};
  return { title: ecosystem.label, description: ecosystem.blurb };
}

export default async function EcosystemPage({ params, searchParams }: EcosystemPageProps) {
  const { slug } = await params;
  const { sort: sortSlug } = await searchParams;
  const ecosystem = getEcosystem(slug);

  if (!ecosystem) {
    notFound();
  }

  const sort =
    sortSlug === "price-asc"
      ? { sortKey: "PRICE" as const, reverse: false }
      : sortSlug === "price-desc"
        ? { sortKey: "PRICE" as const, reverse: true }
        : undefined;

  const { products, hasNextPage, endCursor } = await getProducts({
    searchTerm: ecosystem.query,
    sortKey: sort?.sortKey,
    reverse: sort?.reverse,
  });

  return (
    <CollectionPage
      title={ecosystem.label}
      blurb={ecosystem.blurb}
      query={ecosystem.query}
      products={products}
      hasNextPage={hasNextPage}
      endCursor={endCursor}
      sort={sort}
      sortSlug={sortSlug}
      buildHref={(sort) => buildHref(ecosystem.slug, sort)}
    />
  );
}
