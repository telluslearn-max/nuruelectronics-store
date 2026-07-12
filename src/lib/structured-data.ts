import { SITE_URL } from "@/lib/site";

export type BreadcrumbEntry = { label: string; href?: string };

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
