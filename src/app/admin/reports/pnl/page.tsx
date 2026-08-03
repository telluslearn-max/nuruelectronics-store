import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { computePnl } from "@/lib/reports/pnl";
import { isGoogleSheetsConfigured } from "@/lib/google-sheets";
import { formatPrice } from "@/lib/format";
import { syncPnlNow } from "@/lib/pnl-actions";
import { FeedbackBanner } from "@/components/admin/feedback-banner";
import { moneyColorClass } from "@/components/admin/money-colors";
import { PnlChart } from "@/components/admin/pnl-chart";

export const metadata: Metadata = { title: "Profit & Loss" };

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function monthLabel(bucket: string): string {
  const monthNum = Number(bucket.split("-")[1]);
  return MONTH_LABELS[monthNum - 1];
}

const ROW_DEFS: [string, keyof Awaited<ReturnType<typeof computePnl>>][] = [
  ["Independent Sales", "revenue"],
  ["Refunds (AI-authorized)", "refunds"],
  ["TOTAL REVENUE", "totalRevenue"],
  ["COGS: Personnel", "cogsPersonnel"],
  ["COGS: Software Subscriptions", "cogsSoftware"],
  ["COGS: Other", "cogsOther"],
  ["SG&A: Personnel", "sgaPersonnel"],
  ["SG&A: Software Subscriptions", "sgaSoftware"],
  ["SG&A: Other", "sgaOther"],
  ["Other Expenses", "otherExpenses"],
  ["TOTAL EXPENSES", "totalExpenses"],
  ["PROFIT (LOSS)", "profit"],
];

export default async function AdminPnlPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; success?: string; error?: string }>;
}) {
  await requireAdminSession();

  const now = new Date();
  const pnl = await computePnl({
    from: new Date(now.getFullYear(), 0, 1),
    to: new Date(now.getFullYear() + 1, 0, 1),
    granularity: "monthly",
  });

  const { month: monthParam, success, error } = await searchParams;
  const selectedBucket = monthParam && pnl.buckets.includes(monthParam) ? monthParam : pnl.buckets[now.getMonth()];

  return (
    <div>
      <h2 className="text-lg font-medium">Profit &amp; Loss — {now.getFullYear()}</h2>
      <FeedbackBanner success={success} error={error} />
      <p className="mt-2 text-neutral-500">
        Cash-basis (revenue recognized when received, not when invoiced) — matches the format of the shared Google
        Sheet template. This is deliberately different from the accrual{" "}
        <a href="/admin/reports/income-statement" className="underline hover:text-foreground">
          Income Statement
        </a>
        .
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <form action={syncPnlNow}>
          <button
            type="submit"
            className="rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
          >
            Sync to Google Sheet now
          </button>
        </form>
        <a
          href="/api/reports/pnl/csv?granularity=monthly"
          className="rounded-control border border-border-subtle px-4 py-2 text-sm font-medium hover:border-foreground"
        >
          Download Monthly CSV
        </a>
        <a
          href={`/api/reports/pnl/csv?granularity=daily&month=${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`}
          className="rounded-control border border-border-subtle px-4 py-2 text-sm font-medium hover:border-foreground"
        >
          Download Daily CSV (this month)
        </a>
      </div>

      {!isGoogleSheetsConfigured && (
        <p className="mt-3 text-sm text-neutral-500">
          Set GOOGLE_SERVICE_ACCOUNT_EMAIL/PRIVATE_KEY, PNL_SHEET_ID, and PNL_SHEET_TAB to enable the Google Sheet
          sync — downloads work regardless.
        </p>
      )}

      <div className="mt-8 rounded-card border border-border-subtle p-4">
        <PnlChart
          buckets={pnl.buckets}
          monthLabels={Object.fromEntries(pnl.buckets.map((bucket) => [bucket, monthLabel(bucket)]))}
          totalRevenue={pnl.totalRevenue}
          totalExpenses={pnl.totalExpenses}
          profit={pnl.profit}
        />
      </div>

      <div className="mt-8 sm:hidden">
        <form method="GET" className="mt-4 flex items-end gap-3">
          <div>
            <label className="block text-xs text-neutral-500">Month</label>
            <select
              name="month"
              defaultValue={selectedBucket}
              className="w-full rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground"
            >
              {pnl.buckets.map((bucket) => (
                <option key={bucket} value={bucket}>
                  {monthLabel(bucket)} {now.getFullYear()}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-control border border-border-subtle px-4 py-2 text-sm font-medium hover:border-foreground"
          >
            View
          </button>
        </form>

        <ul className="mt-4 space-y-2">
          {ROW_DEFS.map(([label, key]) => {
            const values = pnl[key] as Record<string, number>;
            const value = values[selectedBucket] ?? 0;
            const isTotalRow = label.startsWith("TOTAL") || label.startsWith("PROFIT");
            const isProfitRow = label.startsWith("PROFIT");
            return (
              <li
                key={label}
                className={`flex items-center justify-between rounded-card border p-3 text-sm ${
                  isTotalRow ? "border-foreground font-medium" : "border-border-subtle"
                }`}
              >
                <span>{label}</span>
                <span className={isProfitRow ? moneyColorClass(value) : undefined}>
                  {formatPrice(value.toFixed(2), "KES")}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-6 hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[720px] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs text-neutral-500">
              <th className="py-2">Description</th>
              {pnl.buckets.map((bucket) => (
                <th key={bucket} className="py-2 text-right">
                  {monthLabel(bucket)}
                </th>
              ))}
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {ROW_DEFS.map(([label, key]) => {
              const values = pnl[key] as Record<string, number>;
              const total = pnl.buckets.reduce((sum, bucket) => sum + (values[bucket] ?? 0), 0);
              const isTotalRow = label.startsWith("TOTAL") || label.startsWith("PROFIT");
              const isProfitRow = label.startsWith("PROFIT");
              return (
                <tr key={label} className={`border-b border-border-subtle/60 ${isTotalRow ? "font-medium" : ""}`}>
                  <td className="py-2">{label}</td>
                  {pnl.buckets.map((bucket) => {
                    const bucketValue = values[bucket] ?? 0;
                    return (
                      <td
                        key={bucket}
                        className={`py-2 text-right ${isProfitRow ? moneyColorClass(bucketValue) : ""}`}
                      >
                        {formatPrice(bucketValue.toFixed(2), "KES")}
                      </td>
                    );
                  })}
                  <td className={`py-2 text-right ${isProfitRow ? moneyColorClass(total) : ""}`}>
                    {formatPrice(total.toFixed(2), "KES")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
