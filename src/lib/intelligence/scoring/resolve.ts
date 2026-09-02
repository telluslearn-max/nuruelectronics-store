import "server-only";
import { prisma } from "@/lib/prisma";
import { confidenceRank } from "@/lib/intelligence/provenance";
import type { ResolvedSpec } from "@/lib/intelligence/scoring/nuru-score";

/**
 * Reads every stored SpecValue for a product and resolves one value per
 * attribute key: the highest-confidence row, ties broken by the most recently
 * collected. A key with no non-null normalizedValue at all is simply absent
 * from the result — never guessed, never defaulted.
 */
export async function resolveProductSpecs(profileId: string): Promise<ResolvedSpec[]> {
  const rows = await prisma.specValue.findMany({
    where: { profileId, normalizedValue: { not: null } },
    select: { key: true, normalizedValue: true, confidence: true, collectedAt: true },
  });

  const best = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const current = best.get(row.key);
    if (
      !current ||
      confidenceRank(row.confidence) > confidenceRank(current.confidence) ||
      (confidenceRank(row.confidence) === confidenceRank(current.confidence) && row.collectedAt > current.collectedAt)
    ) {
      best.set(row.key, row);
    }
  }

  return [...best.values()]
    .filter((row): row is typeof row & { normalizedValue: string } => row.normalizedValue !== null)
    .map((row) => ({ key: row.key, normalizedValue: row.normalizedValue }));
}
