import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { getAccumulatedDepreciation } from "@/lib/depreciation";

export const metadata: Metadata = { title: "Fixed Asset Register" };

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

export default async function AdminFixedAssetRegisterPage() {
  await requireAdminSession();

  const assets = await prisma.fixedAsset.findMany({ orderBy: { purchaseDate: "asc" } });
  const rows = await Promise.all(
    assets.map(async (asset) => {
      const accumulated = await getAccumulatedDepreciation(asset.id);
      return { asset, accumulated, netBookValue: Number(asset.purchaseCost) - accumulated };
    }),
  );

  const totals = rows.reduce(
    (acc, row) => ({
      cost: acc.cost + Number(row.asset.purchaseCost),
      accumulated: acc.accumulated + row.accumulated,
      netBookValue: acc.netBookValue + row.netBookValue,
    }),
    { cost: 0, accumulated: 0, netBookValue: 0 },
  );

  return (
    <div>
      <h2 className="text-lg font-medium">Fixed Asset Register</h2>
      <p className="mt-2 text-neutral-500">Cost, accumulated depreciation, and net book value, as of today.</p>

      <ul className="mt-6 space-y-3 sm:hidden">
        {rows.map(({ asset, accumulated, netBookValue }) => (
          <li key={asset.id} className="rounded-card border border-border-subtle p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span>
                <span className="block font-medium">{asset.name}</span>
                <span className="mt-1 block text-neutral-500">
                  {asset.category} · {formatDate(asset.purchaseDate)} · {asset.disposedAt ? "Disposed" : "In use"}
                </span>
              </span>
              <span className="text-lg font-semibold">{formatPrice(netBookValue.toFixed(2), "KES")}</span>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              Cost {formatPrice(asset.purchaseCost.toString(), "KES")} · Accum. dep.{" "}
              {formatPrice(accumulated.toFixed(2), "KES")}
            </p>
          </li>
        ))}
        {rows.length === 0 && <p className="text-sm text-neutral-500">No fixed assets recorded yet.</p>}
        {rows.length > 0 && (
          <li className="rounded-card border border-foreground p-4 text-sm font-medium">
            <div className="flex justify-between">
              <span>Total</span>
              <span>NBV {formatPrice(totals.netBookValue.toFixed(2), "KES")}</span>
            </div>
            <p className="mt-1 text-xs font-normal text-neutral-500">
              Cost {formatPrice(totals.cost.toFixed(2), "KES")} · Accum. dep.{" "}
              {formatPrice(totals.accumulated.toFixed(2), "KES")}
            </p>
          </li>
        )}
      </ul>

      <div className="mt-6 hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs text-neutral-500">
              <th className="py-2">Asset</th>
              <th className="py-2">Purchased</th>
              <th className="py-2 text-right">Cost</th>
              <th className="py-2 text-right">Accum. depreciation</th>
              <th className="py-2 text-right">Net book value</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ asset, accumulated, netBookValue }) => (
              <tr key={asset.id} className="border-b border-border-subtle/60">
                <td className="py-2">
                  {asset.name} · {asset.category}
                </td>
                <td className="py-2">{formatDate(asset.purchaseDate)}</td>
                <td className="py-2 text-right">{formatPrice(asset.purchaseCost.toString(), "KES")}</td>
                <td className="py-2 text-right">{formatPrice(accumulated.toFixed(2), "KES")}</td>
                <td className="py-2 text-right">{formatPrice(netBookValue.toFixed(2), "KES")}</td>
                <td className="py-2 text-neutral-500">{asset.disposedAt ? "Disposed" : "In use"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-neutral-500">
                  No fixed assets recorded yet.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="font-medium">
                <td className="py-2">Total</td>
                <td className="py-2" />
                <td className="py-2 text-right">{formatPrice(totals.cost.toFixed(2), "KES")}</td>
                <td className="py-2 text-right">{formatPrice(totals.accumulated.toFixed(2), "KES")}</td>
                <td className="py-2 text-right">{formatPrice(totals.netBookValue.toFixed(2), "KES")}</td>
                <td className="py-2" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
