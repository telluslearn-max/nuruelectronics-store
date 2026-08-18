import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Explicit, named allow rules for the major AI crawlers/agents, rather than leaving access to
// them implicit via the wildcard rule below (SEO/AEO audit finding). NURU's competitive read:
// blocking AI training crawlers (as at least one Kenyan competitor does via Cloudflare's
// Content-Signal) means AI assistants can't learn from or freshly cite that domain at all —
// staying open, with genuinely citable structured content, is the actual advantage here. Named
// explicitly so the policy is a deliberate choice on record, not an accident of the wildcard.
const AI_CRAWLER_USER_AGENTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Amazonbot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: "/search",
      },
      ...AI_CRAWLER_USER_AGENTS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: "/search",
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
