import type { MetadataRoute } from "next";
import { categories } from "@/lib/categories";
import { getAllProductHandles } from "@/lib/shopify";

const BASE_URL = "https://www.nuruelectronics.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const handles = await getAllProductHandles();

  return [
    { url: BASE_URL, changeFrequency: "daily", priority: 1 },
    ...categories.map((category) => ({
      url: `${BASE_URL}/category/${category.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...handles.map((handle) => ({
      url: `${BASE_URL}/products/${handle}`,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];
}
