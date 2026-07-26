import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { formatPrice } from "@/lib/format";
import { getCashBook } from "@/lib/reports/cash-book";
import { NEGATIVE_MONEY_CLASS, POSITIVE_MONEY_CLASS } from "@/components/admin/money-colors";

export const metadata: Metadata = { title: "Cash Book" };

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

export default async function AdminCashBookPage() {
  await requireAdminSession();

  const rows = await getCashBook();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Cash Book</h2>
        <a
          href="/api/reports/cash-book/csv"
          className="rounded-control border border-border-subtle px-4 py-2 text-sm font-medium hover:border-foreground"
        >
          Export CSV
        </a>
      </div>
      <p className="mt-2 text-neutral-500">Cash on Hand and M-Pesa movements, in date order, with a running balance.</p>

      <ul className="mt-6 space-y-3 sm:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-card border border-border-subtle p-4 text-sm">
            <div className="flex items-start justify-between gap-3">
              <span>
                <span className="block font-medium">{row.description}</span>
                <span className="mt-1 block text-neutral-500">
                  {row.account} · {formatDate(row.date)}
                </span>
              </span>
              <span className="text-right">
                {row.inflow > 0 && (
                  <span className={`block ${POSITIVE_MONEY_CLASS}`}>+{formatPrice(row.inflow.toFixed(2), "KES")}</span>
                )}
                {row.outflow > 0 && (
                  <span className={`block ${NEGATIVE_MONEY_CLASS}`}>-{formatPrice(row.outflow.toFixed(2), "KES")}</span>
                )}
              </span>
            </div>
            <p className="mt-2 text-right text-xs text-neutral-500">
              Balance {formatPrice(row.balance.toFixed(2), "KES")}
            </p>
          </li>
        ))}
        {rows.length === 0 && <p className="text-sm text-neutral-500">No cash movements yet.</p>}
      </ul>

      <div className="mt-6 hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[640px] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs text-neutral-500">
              <th className="py-2">Date</th>
              <th className="py-2">Description</th>
              <th className="py-2">Account</th>
              <th className="py-2 text-right">In</th>
              <th className="py-2 text-right">Out</th>
              <th className="py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border-subtle/60">
                <td className="py-2">{formatDate(row.date)}</td>
                <td className="py-2">{row.description}</td>
                <td className="py-2 text-neutral-500">{row.account}</td>
                <td className="py-2 text-right">{row.inflow > 0 ? formatPrice(row.inflow.toFixed(2), "KES") : ""}</td>
                <td className="py-2 text-right">{row.outflow > 0 ? formatPrice(row.outflow.toFixed(2), "KES") : ""}</td>
                <td className="py-2 text-right font-medium">{formatPrice(row.balance.toFixed(2), "KES")}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-neutral-500">
                  No cash movements yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
