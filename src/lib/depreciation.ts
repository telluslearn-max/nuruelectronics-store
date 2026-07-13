import "server-only";
import { prisma } from "./prisma";
import { ACCOUNTS, postJournalEntry } from "./ledger";
import type { FixedAsset } from "@prisma/client";

function monthlyDepreciationAmount(asset: Pick<FixedAsset, "purchaseCost" | "salvageValue" | "usefulLifeYears">): number {
  const annual = (Number(asset.purchaseCost) - Number(asset.salvageValue)) / asset.usefulLifeYears;
  return annual / 12;
}

export async function getAccumulatedDepreciation(assetId: string): Promise<number> {
  const lines = await prisma.journalLine.findMany({
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
    const alreadyPosted = await prisma.journalEntry.findFirst({
      where: { sourceType: "depreciation", sourceId: asset.id, date: { gte: monthStart } },
    });
    if (alreadyPosted) continue;

    const depreciableBase = Number(asset.purchaseCost) - Number(asset.salvageValue);
    const accumulated = await getAccumulatedDepreciation(asset.id);
    const amount = Math.min(monthlyDepreciationAmount(asset), depreciableBase - accumulated);
    if (amount <= 0) continue;

    await prisma.$transaction(async (tx) => {
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
    });
    posted++;
  }

  return { posted };
}
