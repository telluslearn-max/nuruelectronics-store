import type { MetadataRoute } from "next";
import { categories } from "@/lib/categories";
import { ecosystems, kits } from "@/lib/collections";
import { getAllProductHandles, getArticles } from "@/lib/shopify";
import { CONTENT_REVISION_DATE, SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [handles, articles] = await Promise.all([getAllProductHandles(), getArticles()]);

  return [
    { url: SITE_URL, lastModified: CONTENT_REVISION_DATE, changeFrequency: "daily", priority: 1 },
    {
      url: `${SITE_URL}/shop`,
      lastModified: CONTENT_REVISION_DATE,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/support`,
      lastModified: CONTENT_REVISION_DATE,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: CONTENT_REVISION_DATE,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: CONTENT_REVISION_DATE,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/coming-soon`,
      lastModified: CONTENT_REVISION_DATE,
      changeFrequency: "daily",
      priority: 0.6,
    },
    ...articles.map((article) => ({
      url: `${SITE_URL}/blog/${article.handle}`,
      lastModified: article.publishedAt,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    ...categories.map((category) => ({
      url: `${SITE_URL}/category/${category.slug}`,
      lastModified: CONTENT_REVISION_DATE,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    {
      url: `${SITE_URL}/ecosystem`,
      lastModified: CONTENT_REVISION_DATE,
      changeFrequency: "daily" as const,
      priority: 0.7,
    },
    ...ecosystems.map((ecosystem) => ({
      url: `${SITE_URL}/ecosystem/${ecosystem.slug}`,
      lastModified: CONTENT_REVISION_DATE,
      changeFrequency: "daily" as const,
      // Featured brands render the same hub layout for every brand (Apple
      // included, via /ecosystem/[slug]) — as much unique content as a
      // category page, so they outrank the ~30 single-brand pages.
      priority: ecosystem.featured ? 0.7 : 0.6,
    })),
    {
      url: `${SITE_URL}/kit`,
      lastModified: CONTENT_REVISION_DATE,
      changeFrequency: "daily" as const,
      priority: 0.7,
    },
    ...kits.map((kit) => ({
      url: `${SITE_URL}/kit/${kit.slug}`,
      lastModified: CONTENT_REVISION_DATE,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
    ...handles.map(({ handle, updatedAt }) => ({
      url: `${SITE_URL}/products/${handle}`,
      lastModified: updatedAt ?? CONTENT_REVISION_DATE,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];
}
