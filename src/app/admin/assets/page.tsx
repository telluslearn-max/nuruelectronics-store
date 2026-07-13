import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { getAccumulatedDepreciation } from "@/lib/depreciation";
import { createFixedAsset, disposeFixedAsset, runMonthlyDepreciation } from "@/lib/fixed-asset-actions";

export const metadata: Metadata = { title: "Fixed Assets" };

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

const inputClass =
  "rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground";
const primaryButtonClass =
  "rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90";
const secondaryButtonClass =
  "rounded-control border border-border-subtle px-4 py-2 text-sm font-medium transition hover:border-foreground";

export default async function AdminFixedAssetsPage() {
  await requireAdminSession();

  const assets = await prisma.fixedAsset.findMany({ orderBy: { purchaseDate: "desc" } });
  const withDepreciation = await Promise.all(
    assets.map(async (asset) => ({
      asset,
      accumulated: await getAccumulatedDepreciation(asset.id),
    })),
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Fixed Assets</h2>
        <form action={runMonthlyDepreciation}>
          <button type="submit" className={secondaryButtonClass}>
            Run monthly depreciation
          </button>
        </form>
      </div>

      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-medium">Add asset</summary>
        <form action={createFixedAsset} className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-neutral-500">Name</label>
            <input type="text" name="name" required className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Category</label>
            <input type="text" name="category" placeholder="Equipment, Furniture…" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Purchase date</label>
            <input type="date" name="purchaseDate" required className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Cost</label>
            <input type="number" step="0.01" name="purchaseCost" required className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Salvage value</label>
            <input type="number" step="0.01" name="salvageValue" defaultValue={0} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Useful life (years)</label>
            <input type="number" name="usefulLifeYears" min={1} required className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Paid from</label>
            <select name="paidFrom" required className={inputClass}>
              <option value="cash">Cash</option>
              <option value="mpesa">M-Pesa</option>
            </select>
          </div>
          <button type="submit" className={primaryButtonClass}>
            Save
          </button>
        </form>
      </details>

      <ul className="mt-6 space-y-3">
        {withDepreciation.map(({ asset, accumulated }) => {
          const netBookValue = Number(asset.purchaseCost) - accumulated;
          return (
            <li key={asset.id} className="rounded-card border border-border-subtle p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {asset.name} · {asset.category} · Purchased {formatDate(asset.purchaseDate)}
                </span>
                <span className="text-neutral-500">
                  Cost {formatPrice(asset.purchaseCost.toString(), "KES")} · Accum. dep.{" "}
                  {formatPrice(accumulated.toFixed(2), "KES")} · NBV {formatPrice(netBookValue.toFixed(2), "KES")}
                </span>
              </div>
              {asset.disposedAt ? (
                <p className="mt-2 text-neutral-500">
                  Disposed {formatDate(asset.disposedAt)} for {formatPrice((asset.disposalValue ?? 0).toString(), "KES")}
                </p>
              ) : (
                <details className="mt-2">
                  <summary className="cursor-pointer text-neutral-500">Dispose</summary>
                  <form action={disposeFixedAsset.bind(null, asset.id)} className="mt-2 flex flex-wrap items-end gap-3">
                    <div>
                      <label className="block text-xs text-neutral-500">Disposal proceeds</label>
                      <input type="number" step="0.01" name="disposalValue" defaultValue={0} className={inputClass} />
                    </div>
                    <button type="submit" className={secondaryButtonClass}>
                      Confirm disposal
                    </button>
                  </form>
                </details>
              )}
            </li>
          );
        })}
        {assets.length === 0 && <p className="text-sm text-neutral-500">No fixed assets recorded yet.</p>}
      </ul>
    </div>
  );
}
