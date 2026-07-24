import "server-only";
import { cosineSimilarity, embedText, embedTexts, isConciergeConfigured } from "@/lib/concierge/embeddings";
import { prisma } from "@/lib/prisma";
import { getProducts } from "@/lib/shopify";
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
  const allProducts: Product[] = [];
  let after: string | undefined;
  for (let page = 0; page < 10; page++) {
    const result = await getProducts({ after, first: 100, includeSpecs: true, includeExUk: true, includeComingSoon: true });
    allProducts.push(...result.products);
    if (!result.hasNextPage || !result.endCursor) break;
    after = result.endCursor;
  }

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
 * Ranks `products` by semantic similarity to `query` using stored embeddings, drops anything below
 * MIN_RELEVANT_SCORE (or with no stored embedding yet), and returns at most `limit` — a search result
 * page, not just a re-sort of everything passed in.
 */
export async function searchProductsSemantic(query: string, products: Product[], limit = 24): Promise<Product[]> {
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
      return { product, score: embedding ? cosineSimilarity(queryEmbedding, embedding) : -1 };
    })
    .filter((entry) => entry.score >= MIN_RELEVANT_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.product);
}
