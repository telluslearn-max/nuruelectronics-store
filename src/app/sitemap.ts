import type { MetadataRoute } from "next";
import { categories } from "@/lib/categories";
import { ecosystems, kits } from "@/lib/collections";
import { getAllProductHandles } from "@/lib/shopify";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const handles = await getAllProductHandles();

  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/shop`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/support`, changeFrequency: "weekly", priority: 0.5 },
    ...categories.map((category) => ({
      url: `${SITE_URL}/category/${category.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    { url: `${SITE_URL}/ecosystem`, changeFrequency: "daily" as const, priority: 0.7 },
    // Apple has a dedicated hub page (src/app/ecosystem/apple) that shadows
    // the generic /ecosystem/[slug] route for this slug, so it's listed once
    // here at a higher priority rather than again via the loop below.
    { url: `${SITE_URL}/ecosystem/apple`, changeFrequency: "daily" as const, priority: 0.7 },
    ...ecosystems
      .filter((ecosystem) => ecosystem.slug !== "apple")
      .map((ecosystem) => ({
        url: `${SITE_URL}/ecosystem/${ecosystem.slug}`,
        changeFrequency: "daily" as const,
        priority: 0.6,
      })),
    { url: `${SITE_URL}/kit`, changeFrequency: "daily" as const, priority: 0.7 },
    ...kits.map((kit) => ({
      url: `${SITE_URL}/kit/${kit.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
    ...handles.map((handle) => ({
      url: `${SITE_URL}/products/${handle}`,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];
}
