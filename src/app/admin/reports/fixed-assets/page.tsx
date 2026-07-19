import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { formatPrice } from "@/lib/format";
import { getFixedAssetsReport } from "@/lib/reports/fixed-assets-report";

export const metadata: Metadata = { title: "Fixed Asset Register" };

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

export default async function AdminFixedAssetRegisterPage() {
  await requireAdminSession();

  const rows = await getFixedAssetsReport();

  const totals = rows.reduce(
    (acc, row) => ({
      cost: acc.cost + row.purchaseCost,
      accumulated: acc.accumulated + row.accumulatedDepreciation,
      netBookValue: acc.netBookValue + row.netBookValue,
    }),
    { cost: 0, accumulated: 0, netBookValue: 0 },
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Fixed Asset Register</h2>
        <a
          href="/api/reports/fixed-assets/csv"
          className="rounded-control border border-border-subtle px-4 py-2 text-sm font-medium hover:border-foreground"
        >
          Export CSV
        </a>
      </div>
      <p className="mt-2 text-neutral-500">Cost, accumulated depreciation, and net book value, as of today.</p>

      <ul className="mt-6 space-y-3 sm:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-card border border-border-subtle p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span>
                <span className="block font-medium">{row.name}</span>
                <span className="mt-1 block text-neutral-500">
                  {row.category} · {formatDate(row.purchaseDate)} · {row.disposedAt ? "Disposed" : "In use"}
                </span>
              </span>
              <span className="text-lg font-semibold">{formatPrice(row.netBookValue.toFixed(2), "KES")}</span>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              Cost {formatPrice(row.purchaseCost.toFixed(2), "KES")} · Accum. dep.{" "}
              {formatPrice(row.accumulatedDepreciation.toFixed(2), "KES")}
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
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border-subtle/60">
                <td className="py-2">
                  {row.name} · {row.category}
                </td>
                <td className="py-2">{formatDate(row.purchaseDate)}</td>
                <td className="py-2 text-right">{formatPrice(row.purchaseCost.toFixed(2), "KES")}</td>
                <td className="py-2 text-right">{formatPrice(row.accumulatedDepreciation.toFixed(2), "KES")}</td>
                <td className="py-2 text-right">{formatPrice(row.netBookValue.toFixed(2), "KES")}</td>
                <td className="py-2 text-neutral-500">{row.disposedAt ? "Disposed" : "In use"}</td>
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
