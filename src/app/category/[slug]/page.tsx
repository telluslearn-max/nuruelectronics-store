import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { chipClass, CollectionPage } from "@/components/collection-page";
import { getCategory } from "@/lib/categories";
import { getProducts } from "@/lib/shopify";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ group?: string; sort?: string }>;
};

function buildHref(slug: string, group?: string, sort?: string) {
  const params = new URLSearchParams();
  if (group) params.set("group", group);
  if (sort) params.set("sort", sort);
  const qs = params.toString();
  return `/category/${slug}${qs ? `?${qs}` : ""}`;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) return {};
  return { title: category.label, description: category.blurb };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params;
  const { group: groupSlug, sort: sortSlug } = await searchParams;
  const category = getCategory(slug);

  if (!category) {
    notFound();
  }

  const activeGroup = category.groups?.find((g) => g.slug === groupSlug);
  const query = activeGroup?.query ?? category.query;
  const sort =
    sortSlug === "price-asc"
      ? { sortKey: "PRICE" as const, reverse: false }
      : sortSlug === "price-desc"
        ? { sortKey: "PRICE" as const, reverse: true }
        : undefined;

  const { products, hasNextPage, endCursor } = await getProducts({
    searchTerm: query,
    sortKey: sort?.sortKey,
    reverse: sort?.reverse,
  });

  const groupChips = category.groups && (
    <div className="mb-4 flex flex-wrap gap-2">
      <Link href={buildHref(category.slug, undefined, sortSlug)} className={chipClass(!activeGroup)}>
        All
      </Link>
      {category.groups.map((g) => (
        <Link
          key={g.slug}
          href={buildHref(category.slug, g.slug, sortSlug)}
          className={chipClass(activeGroup?.slug === g.slug)}
        >
          {g.label}
        </Link>
      ))}
    </div>
  );

  return (
    <CollectionPage
      title={category.label}
      blurb={category.blurb}
      query={query}
      products={products}
      hasNextPage={hasNextPage}
      endCursor={endCursor}
      sort={sort}
      sortSlug={sortSlug}
      buildHref={(sort) => buildHref(category.slug, activeGroup?.slug, sort)}
      groupChips={groupChips}
    />
  );
}
