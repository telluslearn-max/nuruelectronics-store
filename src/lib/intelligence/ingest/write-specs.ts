import "server-only";
import type { IntelSourceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { confidenceForSourceType } from "@/lib/intelligence/provenance";

/**
 * Replaces one product's stored specs from a single source type with a fresh
 * set, in one transaction: drop the old rows (and any source row left
 * orphaned), then write the new ones at the confidence that source type
 * implies. Shared by the AI/metafield sync and the curated seed so a re-run
 * corrects the record rather than accumulating rows in it.
 */
export type SpecWrite = {
  key: string;
  rawValue: string;
  normalizedValue: string | null;
  unit: string | null;
};

export async function replaceProfileSpecs(
  profileId: string,
  sourceType: IntelSourceType,
  label: string,
  reference: string | null,
  values: SpecWrite[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const stale = await tx.specValue.findMany({
      where: { profileId, source: { type: sourceType } },
      select: { id: true, sourceId: true },
    });
    if (stale.length > 0) {
      await tx.specValue.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
      for (const sourceId of [...new Set(stale.map((s) => s.sourceId))]) {
        const remaining = await tx.specValue.count({ where: { sourceId } });
        if (remaining === 0) await tx.intelSource.delete({ where: { id: sourceId } }).catch(() => undefined);
      }
    }

    if (values.length === 0) return;

    const source = await tx.intelSource.create({ data: { type: sourceType, label, reference } });
    const confidence = confidenceForSourceType(sourceType);
    await tx.specValue.createMany({
      data: values.map((v) => ({
        profileId,
        key: v.key,
        rawValue: v.rawValue,
        normalizedValue: v.normalizedValue,
        unit: v.unit,
        confidence,
        sourceId: source.id,
      })),
    });
  });
}
