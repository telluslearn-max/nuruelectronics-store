import "server-only";
import { prisma } from "@/lib/prisma";
import type { ScoredCandidate } from "@/lib/intelligence/recommend/rank";
import type { ScoreComponent } from "@/lib/intelligence/types";

/**
 * Loads the scored-product pool for a category from the NuruScore cache — the
 * input the ranking, recommendation, "why not" and alternatives functions all
 * operate on. Kept separate from those (which are pure) so they stay testable
 * without a database.
 */

export type DbScoredCandidate = ScoredCandidate & {
  profileId: string;
  category: string;
  composite: number | null;
};

/** Every product in `categoryId` that has a computed NURU Score, with its component scores. */
export async function getScoredCandidates(categoryId: string): Promise<DbScoredCandidate[]> {
  const rows = await prisma.nuruScore.findMany({
    where: { category: categoryId },
    select: {
      profileId: true,
      category: true,
      components: true,
      composite: true,
      profile: { select: { handle: true } },
    },
  });

  return rows.map((row) => ({
    profileId: row.profileId,
    handle: row.profile.handle,
    category: row.category,
    components: (row.components ?? {}) as Partial<Record<ScoreComponent, number>>,
    composite: row.composite === null ? null : Number(row.composite),
  }));
}

/** One product's scored candidate by handle, or null if it has no computed score. */
export async function getScoredCandidateByHandle(handle: string): Promise<DbScoredCandidate | null> {
  const profile = await prisma.productProfile.findUnique({
    where: { handle },
    select: { id: true, category: true, nuruScore: { select: { components: true, composite: true } } },
  });
  if (!profile?.nuruScore) return null;
  return {
    profileId: profile.id,
    handle,
    category: profile.category,
    components: (profile.nuruScore.components ?? {}) as Partial<Record<ScoreComponent, number>>,
    composite: profile.nuruScore.composite === null ? null : Number(profile.nuruScore.composite),
  };
}
