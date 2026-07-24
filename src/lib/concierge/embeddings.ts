import "server-only";
import { getGenAIClient, isConciergeConfigured } from "./vertex-client";

/** Vertex AI's standard text embedding model — separate from the CONCIERGE_MODEL used for chat. */
export const EMBEDDING_MODEL = "text-embedding-004";

export { isConciergeConfigured };

/** Embeds a batch of texts in one request, in the same order they were passed in. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const ai = getGenAIClient();
  const response = await ai.models.embedContent({ model: EMBEDDING_MODEL, contents: texts });
  return (response.embeddings ?? []).map((e) => e.values ?? []);
}

export async function embedText(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text]);
  return embedding ?? [];
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
