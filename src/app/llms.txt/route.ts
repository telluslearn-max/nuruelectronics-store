import { categories } from "@/lib/categories";
import { ecosystems, kits } from "@/lib/collections";
import { SITE_URL } from "@/lib/site";

/**
 * llms.txt (see llmstxt.org) — a plain-text index pointing AI crawlers/agents at the
 * highest-value pages first. Distinct from robots.ts (which governs *whether* a crawler may
 * fetch a URL): this exists purely to reduce the odds a crawler's limited budget gets spent on
 * low-value routes (cart, account, search results) before ever reaching the category/ecosystem
 * hubs and buying guides that are actually worth citing — meaningful for a catalog this size
 * (300+ URLs in sitemap.xml). Built from the same category/ecosystem/kit source data as the
 * sitemap and nav, rather than hand-duplicated, so it can't silently drift out of date.
 */
export async function GET() {
  const categoryLines = categories
    .map((c) => `- [${c.label}](${SITE_URL}/category/${c.slug}): ${c.blurb}`)
    .join("\n");

  const featuredEcosystems = ecosystems.filter((e) => e.featured);
  const ecosystemLines = featuredEcosystems
    .map((e) => `- [${e.label}](${SITE_URL}/ecosystem/${e.slug}): ${e.blurb}`)
    .join("\n");

  const kitLines = kits.map((k) => `- [${k.label}](${SITE_URL}/kit/${k.slug}): ${k.blurb}`).join("\n");

  const body = `# NURU

> NURU is a Kenya-based electronics retailer selling genuine phones, laptops, audio, gaming, cameras, and appliances — 100% authentic with manufacturer warranty, fast Nairobi/countrywide delivery, and Buy Now Pay Later financing.

Full URL index: ${SITE_URL}/sitemap.xml

## Shop by category
${categoryLines}

## Shop by brand
${ecosystemLines}

## Shop by use case
${kitLines}

## For AI agents
NURU exposes its catalog, product-intelligence, and commerce capabilities to in-browser agents via WebMCP (\`navigator.modelContext\`) on every storefront page — search, compare, NURU Score / personalized Fit Score, alternatives, add-to-cart, and a checkout hand-off. The same capabilities are available as a JSON HTTP service under \`${SITE_URL}/api/products/*\`.

## Distinctive to NURU
- [Ex-UK deals](${SITE_URL}/ex-uk): Unboxed, UK-imported phones at a lower price than new, still covered by a 1-year warranty — not offered by competing Kenyan electronics retailers benchmarked in NURU's own SEO audit.
- [Trade-In](${SITE_URL}/trade-in): Trade in an old device for credit toward a new one.
- [Returns & warranty](${SITE_URL}/returns): Self-service returns and warranty claims.

## Guides
- [Blog](${SITE_URL}/blog): Buying guides and product explainers.
- [Support](${SITE_URL}/support): Delivery, payment, and order help.

## Optional
- [About](${SITE_URL}/about)
- [Careers](${SITE_URL}/careers)
- [Gift Cards](${SITE_URL}/gift-cards)
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
