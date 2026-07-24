import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { formatPrice } from "@/lib/format";
import { getRidersImpactReport } from "@/lib/reports/riders-impact";

export const metadata: Metadata = { title: "Rider Job-Creation Impact" };

export default async function AdminRidersImpactPage() {
  await requireAdminSession();

  const { rows, summary } = await getRidersImpactReport();

  return (
    <div>
      <h2 className="text-lg font-medium">Rider Job-Creation Impact</h2>
      <p className="mt-2 text-neutral-500">
        Gig-delivery jobs created — active riders, deliveries completed, and total paid out.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-card border border-border-subtle p-4">
          <p className="text-xs text-neutral-500">Active riders</p>
          <p className="mt-1 text-lg font-semibold">{summary.activeRiders}</p>
        </div>
        <div className="rounded-card border border-border-subtle p-4">
          <p className="text-xs text-neutral-500">Deliveries completed</p>
          <p className="mt-1 text-lg font-semibold">{summary.totalDeliveries}</p>
        </div>
        <div className="rounded-card border border-border-subtle p-4">
          <p className="text-xs text-neutral-500">Total paid to riders</p>
          <p className="mt-1 text-lg font-semibold">{formatPrice(summary.totalPaidOut.toFixed(2), "KES")}</p>
        </div>
      </div>

      <h3 className="mt-6 text-sm font-medium">By rider</h3>
      <ul className="mt-3 space-y-3 sm:hidden">
        {rows.map((row) => (
          <li key={row.riderId} className="flex items-center justify-between gap-3 rounded-card border border-border-subtle p-4 text-sm">
            <span>
              <span className="block font-medium">{row.name}</span>
              <span className="mt-1 block text-neutral-500">{row.deliveriesCompleted} deliveries</span>
            </span>
            <span className="text-lg font-semibold">{formatPrice(row.totalPaid.toFixed(2), "KES")}</span>
          </li>
        ))}
        {rows.length === 0 && <p className="text-sm text-neutral-500">No deliveries tagged to a rider yet.</p>}
      </ul>

      <div className="mt-3 hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs text-neutral-500">
              <th className="py-2">Rider</th>
              <th className="py-2 text-right">Deliveries</th>
              <th className="py-2 text-right">Total paid</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.riderId} className="border-b border-border-subtle/60">
                <td className="py-2">{row.name}</td>
                <td className="py-2 text-right">{row.deliveriesCompleted}</td>
                <td className="py-2 text-right">{formatPrice(row.totalPaid.toFixed(2), "KES")}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-neutral-500">
                  No deliveries tagged to a rider yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
