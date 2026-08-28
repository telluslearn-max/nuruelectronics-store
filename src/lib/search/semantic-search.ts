import "server-only";
import { cosineSimilarity, embedText, embedTexts, isConciergeConfigured } from "@/lib/concierge/embeddings";
import { prisma } from "@/lib/prisma";
import { getAllProducts } from "@/lib/shopify";
import type { Product } from "@/lib/shopify/types";

/** True once Vertex AI is configured AND at least one product has been embedded (the cron has run at least once). */
export async function isSemanticSearchReady(): Promise<boolean> {
  if (!isConciergeConfigured) return false;
  const count = await prisma.productEmbedding.count();
  return count > 0;
}

/** A short, descriptive string per product — richer signal for the embedding than the title alone. */
function buildProductEmbeddingText(product: Product): string {
  const specs = (product.specs ?? []).map((s) => `${s.key}: ${s.value}`).join(", ");
  return [product.title, product.productType, product.vendor, product.tags.join(", "), specs]
    .filter(Boolean)
    .join(" — ");
}

const EMBEDDING_BATCH_SIZE = 20;

/**
 * (Re)computes and upserts embeddings for the whole browsable catalog (mirrors getAllProductHandles'
 * pagination), run from a daily cron (see src/app/api/cron/sync-product-embeddings/route.ts). Ex-UK
 * and coming-soon products are included since they're still individually reachable/searchable.
 */
export async function syncProductEmbeddings(): Promise<{ productsEmbedded: number }> {
  const allProducts = await getAllProducts({ includeSpecs: true, includeExUk: true, includeComingSoon: true });

  let productsEmbedded = 0;
  for (let i = 0; i < allProducts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = allProducts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const vectors = await embedTexts(batch.map(buildProductEmbeddingText));
    await Promise.all(
      batch.map((product, index) =>
        prisma.productEmbedding.upsert({
          where: { handle: product.handle },
          create: { handle: product.handle, embedding: vectors[index] ?? [] },
          update: { embedding: vectors[index] ?? [] },
        }),
      ),
    );
    productsEmbedded += batch.length;
  }

  return { productsEmbedded };
}

/** Below this cosine similarity, a result is considered unrelated to the query rather than just "less relevant". */
const MIN_RELEVANT_SCORE = 0.5;

/**
 * Pure embedding similarity ranks a short, title-only accessory listing (e.g. "iPhone 15 Case")
 * about as close to a bare query like "iphone" as the actual iPhone product lines, whose longer
 * spec-heavy embedding text dilutes the match — so a shopper searching a product family's name can
 * see accessories crowd out the product itself (audit finding H1). A literal title match is the
 * strongest relevance signal there is, so it's added as a flat boost on top of the semantic score
 * rather than trusted to emerge from cosine similarity alone.
 */
function titleMatchBoost(title: string, query: string): number {
  const normalizedTitle = title.toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return 0;
  if (normalizedTitle === normalizedQuery) return 2;
  if (normalizedTitle.startsWith(normalizedQuery)) return 1.5;
  if (normalizedTitle.includes(normalizedQuery)) return 1;
  return 0;
}

/**
 * Ranks `products` by semantic similarity to `query` (boosted by literal title matches — see
 * titleMatchBoost) using stored embeddings, drops anything below MIN_RELEVANT_SCORE (or with no
 * stored embedding yet), and returns at most `limit` — a search result page, not just a re-sort of
 * everything passed in.
 */
export async function searchProductsSemantic(query: string, products: Product[], limit = 40): Promise<Product[]> {
  if (products.length === 0) return products;

  const stored = await prisma.productEmbedding.findMany({
    where: { handle: { in: products.map((p) => p.handle) } },
  });
  const embeddingByHandle = new Map(stored.map((row) => [row.handle, row.embedding]));
  if (embeddingByHandle.size === 0) return [];

  const queryEmbedding = await embedText(query);
  if (queryEmbedding.length === 0) return [];

  return products
    .map((product) => {
      const embedding = embeddingByHandle.get(product.handle);
      const semanticScore = embedding ? cosineSimilarity(queryEmbedding, embedding) : -1;
      return { product, semanticScore, score: semanticScore + titleMatchBoost(product.title, query) };
    })
    .filter((entry) => entry.semanticScore >= MIN_RELEVANT_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.product);
}
