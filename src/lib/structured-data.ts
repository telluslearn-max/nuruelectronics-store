import { SITE_URL } from "@/lib/site";
import type { Article, Product } from "@/lib/shopify/types";

export type BreadcrumbEntry = { label: string; href?: string };

/**
 * ItemList schema for a product listing page — helps AI assistants and rich results understand
 * "this page lists N product models," beyond the individual Product schema each product page
 * already carries. Shared so every listing surface emits the identical shape; previously only
 * defined inline in collection-page.tsx (category pages, and the *non-featured* ecosystem
 * branch), leaving the featured/hub ecosystem layout (Apple, Samsung, etc. — the multi-category
 * brand pages with the richest content) without it.
 */
export function buildItemListJsonLd(title: string, products: Product[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${SITE_URL}/products/${product.handle}`,
      name: product.title,
    })),
  };
}

/** BreadcrumbList schema matching the visible trail rendered by `Breadcrumb` — same `items` shape, so the two can never drift apart. */
export function buildBreadcrumbJsonLd(items: BreadcrumbEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: `${SITE_URL}${item.href}` } : {}),
    })),
  };
}

/**
 * Article schema for blog posts — the SEO/AEO audit's strongest single signal for AI answer
 * engines (Google AI Overviews, Perplexity) to attribute and cite a specific author/date/
 * publisher, and previously entirely absent from blog content. `dateModified` falls back to
 * `datePublished` since the Article type has no separate updated-at field to source it from.
 */
export function buildArticleJsonLd(article: Article, handle: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt,
    datePublished: article.publishedAt,
    dateModified: article.publishedAt,
    url: `${SITE_URL}/blog/${handle}`,
    ...(article.image ? { image: [article.image.url] } : {}),
    author: article.author
      ? { "@type": "Person", name: article.author }
      : { "@type": "Organization", name: "NURU" },
    publisher: {
      "@type": "Organization",
      name: "NURU",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/icon.svg` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/blog/${handle}` },
  };
}
