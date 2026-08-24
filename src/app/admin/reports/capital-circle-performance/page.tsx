import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { getWeeklyComparisonReport } from "@/lib/reports/capital-circle";
import { formatPrice } from "@/lib/format";
import { moneyColorClass } from "@/components/admin/money-colors";

export const metadata: Metadata = { title: "Capital Circle Performance" };

const SWEEP_STATUS_LABEL: Record<string, string> = {
  confirmed: "Swept",
  pending: "Pending confirmation",
  none: "Not yet run",
};

export default async function CapitalCirclePerformancePage() {
  await requireAdminSession();
  const rows = await getWeeklyComparisonReport(8);

  return (
    <div>
      <h2 className="text-lg font-medium">Capital Circle — Performance</h2>
      <p className="mt-2 max-w-2xl text-neutral-500">
        The core business&apos;s weekly profit next to the AI pot&apos;s weekly result — the signal for whether to grow, shrink,
        or shut the pot down. Trailing 8 weeks, most recent first.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs text-neutral-500">
              <th className="py-2">Week</th>
              <th className="py-2 text-right">Core Business Profit</th>
              <th className="py-2 text-right">Swept to Circle</th>
              <th className="py-2 text-right">AI Pot Result (realized)</th>
              <th className="py-2 text-right">AI Pot Open Exposure</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.weekStart.toISOString()} className="border-b border-border-subtle/60">
                <td className="py-2">
                  <div>{row.weekStart.toLocaleDateString("en-US", { dateStyle: "medium" })}</div>
                  <div className="text-xs text-neutral-400">{SWEEP_STATUS_LABEL[row.sweepStatus]}</div>
                </td>
                <td className={`py-2 text-right ${moneyColorClass(row.corePnlUsd)}`}>
                  {formatPrice(row.corePnlUsd.toFixed(2), "USD")}
                </td>
                <td className="py-2 text-right">{formatPrice(row.sweptUsd.toFixed(2), "USD")}</td>
                <td className={`py-2 text-right ${moneyColorClass(row.aiPositionsResultUsd)}`}>
                  {formatPrice(row.aiPositionsResultUsd.toFixed(2), "USD")}
                </td>
                <td className="py-2 text-right">{formatPrice(row.aiPositionsOpenUsd.toFixed(2), "USD")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-neutral-500">
        &quot;AI Pot Open Exposure&quot; is a current snapshot (positions still unresolved right now), shown on every
        row for context — not a historical reconstruction of what was open in each past week.
      </p>
    </div>
  );
}
