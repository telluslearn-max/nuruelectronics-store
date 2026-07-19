import "server-only";
import { prisma } from "../prisma";
import { getAccumulatedDepreciation } from "../depreciation";
import { rowsToCsv } from "./csv";

export type FixedAssetRow = {
  id: string;
  name: string;
  category: string;
  purchaseDate: Date;
  purchaseCost: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  disposedAt: Date | null;
};

/** Cost, accumulated depreciation, and net book value for every asset, as of today. */
export async function getFixedAssetsReport(): Promise<FixedAssetRow[]> {
  const assets = await prisma.fixedAsset.findMany({ orderBy: { purchaseDate: "asc" } });
  return Promise.all(
    assets.map(async (asset) => {
      const accumulated = await getAccumulatedDepreciation(asset.id);
      return {
        id: asset.id,
        name: asset.name,
        category: asset.category,
        purchaseDate: asset.purchaseDate,
        purchaseCost: Number(asset.purchaseCost),
        accumulatedDepreciation: accumulated,
        netBookValue: Number(asset.purchaseCost) - accumulated,
        disposedAt: asset.disposedAt,
      };
    }),
  );
}

export function fixedAssetsReportToCsv(rows: FixedAssetRow[]): string {
  const totals = rows.reduce(
    (acc, row) => ({
      cost: acc.cost + row.purchaseCost,
      accumulated: acc.accumulated + row.accumulatedDepreciation,
      netBookValue: acc.netBookValue + row.netBookValue,
    }),
    { cost: 0, accumulated: 0, netBookValue: 0 },
  );

  return rowsToCsv(
    ["Asset", "Category", "Purchased", "Cost", "Accum. depreciation", "Net book value", "Status"],
    [
      ...rows.map((row) => [
        row.name,
        row.category,
        row.purchaseDate.toISOString().slice(0, 10),
        row.purchaseCost.toFixed(2),
        row.accumulatedDepreciation.toFixed(2),
        row.netBookValue.toFixed(2),
        row.disposedAt ? "Disposed" : "In use",
      ]),
      ["", "", "Total", totals.cost.toFixed(2), totals.accumulated.toFixed(2), totals.netBookValue.toFixed(2), ""],
    ],
  );
}
