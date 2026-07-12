import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CollectionPage } from "@/components/collection-page";
import { getKit } from "@/lib/collections";
import { getProducts } from "@/lib/shopify";

type KitPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string }>;
};

function buildHref(slug: string, sort?: string) {
  const params = new URLSearchParams();
  if (sort) params.set("sort", sort);
  const qs = params.toString();
  return `/kit/${slug}${qs ? `?${qs}` : ""}`;
}

export async function generateMetadata({ params }: KitPageProps): Promise<Metadata> {
  const { slug } = await params;
  const kit = getKit(slug);
  if (!kit) return {};
  // Sort variants reorder the same product set rather than changing it, so
  // they canonicalize back to the plain kit URL instead of self-referencing.
  return { title: kit.label, description: kit.blurb, alternates: { canonical: `/kit/${slug}` } };
}

export default async function KitPage({ params, searchParams }: KitPageProps) {
  const { slug } = await params;
  const { sort: sortSlug } = await searchParams;
  const kit = getKit(slug);

  if (!kit) {
    notFound();
  }

  const sort =
    sortSlug === "price-asc"
      ? { sortKey: "PRICE" as const, reverse: false }
      : sortSlug === "price-desc"
        ? { sortKey: "PRICE" as const, reverse: true }
        : undefined;

  const { products, hasNextPage, endCursor } = await getProducts({
    searchTerm: kit.query,
    sortKey: sort?.sortKey,
    reverse: sort?.reverse,
  });

  return (
    <CollectionPage
      title={kit.label}
      blurb={kit.blurb}
      query={kit.query}
      products={products}
      hasNextPage={hasNextPage}
      endCursor={endCursor}
      sort={sort}
      sortSlug={sortSlug}
      buildHref={(sort) => buildHref(kit.slug, sort)}
    />
  );
}
