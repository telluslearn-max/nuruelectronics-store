import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { ACCOUNTS, postJournalEntry } from "./ledger";
import type { FixedAsset } from "@prisma/client";

function monthlyDepreciationAmount(asset: Pick<FixedAsset, "purchaseCost" | "salvageValue" | "usefulLifeYears">): number {
  const annual = (Number(asset.purchaseCost) - Number(asset.salvageValue)) / asset.usefulLifeYears;
  return annual / 12;
}

export async function getAccumulatedDepreciation(
  assetId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<number> {
  const lines = await client.journalLine.findMany({
    where: {
      journalEntry: { sourceType: "depreciation", sourceId: assetId },
      account: { code: ACCOUNTS.ACCUMULATED_DEPRECIATION },
    },
  });
  return lines.reduce((sum, line) => sum + Number(line.credit) - Number(line.debit), 0);
}

/**
 * Posts this calendar month's straight-line depreciation for every
 * non-disposed asset that hasn't already been posted this month. Safe to run
 * daily (e.g. from the same cron as the P&L sync) — it's a no-op for assets
 * already posted this month or fully depreciated.
 */
export async function postMonthlyDepreciation(): Promise<{ posted: number }> {
  const assets = await prisma.fixedAsset.findMany({ where: { disposedAt: null } });
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  let posted = 0;

  for (const asset of assets) {
    const didPost = await prisma.$transaction(async (tx) => {
      // Serialize concurrent postings for this asset+month — JournalEntry has no natural unique
      // constraint to enforce "one depreciation entry per asset per month" at the DB level, so
      // without this lock, two overlapping callers (e.g. the daily cron firing while someone
      // manually triggers depreciation) could both pass the "already posted" check below before
      // either commits, double-posting the month. Released automatically at transaction end.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`depreciation:${asset.id}:${monthStart.toISOString()}`}, 0))`;

      const alreadyPosted = await tx.journalEntry.findFirst({
        where: { sourceType: "depreciation", sourceId: asset.id, date: { gte: monthStart } },
      });
      if (alreadyPosted) return false;

      const depreciableBase = Number(asset.purchaseCost) - Number(asset.salvageValue);
      const accumulated = await getAccumulatedDepreciation(asset.id, tx);
      const amount = Math.min(monthlyDepreciationAmount(asset), depreciableBase - accumulated);
      if (amount <= 0) return false;

      await postJournalEntry(tx, {
        date: now,
        description: `Depreciation: ${asset.name}`,
        sourceType: "depreciation",
        sourceId: asset.id,
        lines: [
          { accountCode: ACCOUNTS.DEPRECIATION_EXPENSE, debit: amount },
          { accountCode: ACCOUNTS.ACCUMULATED_DEPRECIATION, credit: amount },
        ],
      });
      return true;
    });
    if (didPost) posted++;
  }

  return { posted };
}
