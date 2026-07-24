import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { CategoryGuide } from "@/components/category-guide";
import { chipClass, CollectionPage } from "@/components/collection-page";
import { GenreTiles } from "@/components/genre-tiles";
import { getCategory, getGameGenre, getRelatedCategories } from "@/lib/categories";
import { getCategoryGuide } from "@/lib/category-guides";
import { getProducts } from "@/lib/shopify";
import type { Product } from "@/lib/shopify/types";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ group?: string; sort?: string; genre?: string }>;
};

function buildHref(slug: string, group?: string, sort?: string, genre?: string) {
  const params = new URLSearchParams();
  if (group) params.set("group", group);
  if (sort) params.set("sort", sort);
  if (genre) params.set("genre", genre);
  const qs = params.toString();
  return `/category/${slug}${qs ? `?${qs}` : ""}`;
}

export async function generateMetadata({ params, searchParams }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { group, genre } = await searchParams;
  const category = getCategory(slug);
  if (!category) return {};
  // A group or genre filter is a genuinely different product set, so it gets
  // its own canonical; sort only reorders that same set, so it's always dropped.
  const activeGroup = category.groups?.find((g) => g.slug === group);
  const activeGenre = activeGroup?.slug === "games" ? getGameGenre(genre ?? "") : undefined;
  const canonical = activeGroup
    ? buildHref(slug, activeGroup.slug, undefined, activeGenre?.slug)
    : `/category/${slug}`;
  return { title: category.label, description: category.blurb, alternates: { canonical } };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params;
  const { group: groupSlug, sort: sortSlug, genre: genreSlug } = await searchParams;
  const category = getCategory(slug);

  if (!category) {
    notFound();
  }

  const activeGroup = category.groups?.find((g) => g.slug === groupSlug);
  const isGamesGroup = activeGroup?.slug === "games";
  const activeGenre = isGamesGroup ? getGameGenre(genreSlug ?? "") : undefined;
  const query = activeGenre
    ? `${activeGroup!.query} AND ${activeGenre.query}`
    : (activeGroup?.query ?? category.query);
  const sort =
    sortSlug === "price-asc"
      ? { sortKey: "PRICE" as const, reverse: false }
      : sortSlug === "price-desc"
        ? { sortKey: "PRICE" as const, reverse: true }
        : undefined;

  const relatedEdges = getRelatedCategories(category.slug);
  const guide = getCategoryGuide(category.slug);

  // When browsing the whole category (no group filter), pull one best-seller
  // per line instead of ranking across all of them — otherwise a single
  // dominant brand/series can crowd out the rest of the lineup entirely.
  const showLineupBreadth = !activeGroup && (category.groups?.length ?? 0) > 0;
  const flagshipPromise: Promise<{ products: Product[] }> = showLineupBreadth
    ? Promise.all(
        category.groups!
          .slice(0, 8)
          .map((g) => getProducts({ searchTerm: g.query, sortKey: "BEST_SELLING", first: 1 })),
      ).then((pages) => ({ products: pages.flatMap((p) => p.products) }))
    : getProducts({ searchTerm: query, sortKey: "BEST_SELLING", first: 8 });

  // Pre-release games surfaced as their own rail, gaming category only.
  const comingSoonPromise: Promise<Product[]> =
    category.slug === "gaming"
      ? getProducts({ searchTerm: `product_type:"Games" AND tag:coming-soon`, first: 8 }).then(
          (p) => p.products,
        )
      : Promise.resolve([]);

  const [{ products, hasNextPage, endCursor }, flagshipPage, relatedPages, comingSoonProducts] =
    await Promise.all([
      getProducts({
        searchTerm: query,
        sortKey: sort?.sortKey,
        reverse: sort?.reverse,
      }),
      flagshipPromise,
      Promise.all(
        relatedEdges.map((edge) =>
          getProducts({ searchTerm: edge.category.query, sortKey: "BEST_SELLING", first: 8 }),
        ),
      ),
      comingSoonPromise,
    ]);

  const relatedCategories = relatedEdges
    .map((edge, i) => ({
      label: edge.category.label,
      slug: edge.category.slug,
      reason: edge.reason,
      products: relatedPages[i]?.products ?? [],
    }))
    .filter((entry) => entry.products.length > 0);

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

  const genreNav = isGamesGroup && (
    <GenreTiles
      basePath={buildHref(category.slug, activeGroup!.slug, sortSlug)}
      activeGenre={activeGenre?.slug}
    />
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
      buildHref={(sort) => buildHref(category.slug, activeGroup?.slug, sort, activeGenre?.slug)}
      groupChips={
        <>
          {groupChips}
          {genreNav}
        </>
      }
      flagshipProducts={flagshipPage.products}
      comingSoonProducts={comingSoonProducts}
      relatedCategories={relatedCategories}
      breadcrumb={<Breadcrumb items={[{ label: "Home", href: "/" }, { label: category.label }]} />}
      categoryGuide={guide && <CategoryGuide guide={guide} />}
    />
  );
}
