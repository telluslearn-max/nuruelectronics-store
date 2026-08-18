// Manual/local runner for the same check the /api/cron/product-readiness route runs
// on a schedule (see that route for the GCP Cloud Scheduler / Vercel Cron setup).
// Catches products that would go live half-empty — no image, no real price, a stub
// description, or missing SEO fields.
//
// Kept self-contained (own fetch, not importing src/lib/shopify/admin-api.ts) because
// that module imports the "server-only" package, which unconditionally throws outside
// Next's build (it only resolves to a no-op under the "react-server" bundler condition
// Next sets) — so it can't be required from a plain tsx/node script.
//
// Usage:
//   npx tsx scripts/check-product-readiness.ts             # active products only
//   npx tsx scripts/check-product-readiness.ts --include-drafts

import "dotenv/config";

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const adminToken = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
const apiVersion = "2024-10";

const MIN_DESCRIPTION_LENGTH = 50;

type ProductNode = {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  featuredImage: { id: string } | null;
  seo: { title: string | null; description: string | null };
  variants: { edges: { node: { price: string } }[] };
};

const query = `
  query ReadinessCheck($after: String, $query: String) {
    products(first: 50, after: $after, query: $query) {
      edges {
        node {
          id
          title
          handle
          descriptionHtml
          featuredImage { id }
          seo { title description }
          variants(first: 5) { edges { node { price } } }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

async function fetchAllProducts(statusQuery: string): Promise<ProductNode[]> {
  const results: ProductNode[] = [];
  let after: string | undefined;
  for (let page = 0; page < 40; page++) {
    const res = await fetch(`https://${domain}/admin/api/${apiVersion}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": adminToken as string },
      body: JSON.stringify({ query, variables: { after, query: statusQuery } }),
    });
    const json = await res.json();
    if (json.errors) throw new Error(JSON.stringify(json.errors));
    const products = json.data.products as {
      edges: { node: ProductNode }[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
    results.push(...products.edges.map((e) => e.node));
    if (!products.pageInfo.hasNextPage) break;
    after = products.pageInfo.endCursor ?? undefined;
  }
  return results;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

type Violation = { handle: string; title: string; reasons: string[] };

function checkProduct(p: ProductNode): Violation | null {
  const reasons: string[] = [];
  if (!p.featuredImage) reasons.push("no featured image");
  const prices = p.variants.edges.map((e) => Number(e.node.price));
  if (prices.length === 0 || prices.every((price) => price === 0)) reasons.push("price is 0.00");
  if (stripHtml(p.descriptionHtml).length < MIN_DESCRIPTION_LENGTH) {
    reasons.push(`description under ${MIN_DESCRIPTION_LENGTH} characters`);
  }
  if (!p.seo.title || !p.seo.description) reasons.push("missing SEO title/description");
  return reasons.length > 0 ? { handle: p.handle, title: p.title, reasons } : null;
}

async function main() {
  if (!domain || !adminToken) {
    console.error("SHOPIFY_STORE_DOMAIN / SHOPIFY_ADMIN_API_ACCESS_TOKEN aren't set.");
    process.exit(1);
  }

  const includeDrafts = process.argv.includes("--include-drafts");
  const statusQuery = includeDrafts ? "status:active OR status:draft" : "status:active";
  const products = await fetchAllProducts(statusQuery);

  const violations = products.map(checkProduct).filter((v): v is Violation => v !== null);

  if (violations.length === 0) {
    console.log(`All ${products.length} checked products pass readiness checks.`);
    return;
  }

  console.log(`${violations.length} of ${products.length} checked products fail readiness checks:\n`);
  for (const v of violations) {
    console.log(`- ${v.title} (/${v.handle}): ${v.reasons.join(", ")}`);
  }
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
