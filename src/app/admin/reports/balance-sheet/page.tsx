import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { getAccountBalances, creditBalance, debitBalance } from "@/lib/reports/ledger-reports";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Balance Sheet" };

export default async function AdminBalanceSheetPage() {
  await requireAdminSession();

  const rows = await getAccountBalances();
  const assets = rows.filter((r) => r.account.type === "asset");
  const liabilities = rows.filter((r) => r.account.type === "liability");
  const equity = rows.filter((r) => r.account.type === "equity");
  const revenue = rows.filter((r) => r.account.type === "revenue");
  const expense = rows.filter((r) => r.account.type === "expense");

  const totalAssets = assets.reduce((sum, r) => sum + debitBalance(r), 0);
  const totalLiabilities = liabilities.reduce((sum, r) => sum + creditBalance(r), 0);
  const recordedEquity = equity.reduce((sum, r) => sum + creditBalance(r), 0);
  // Undistributed net income (all revenue to date minus all expenses to date) rolls into equity here,
  // since there's no period-close process moving it into Retained Earnings automatically.
  const netIncomeToDate =
    revenue.reduce((sum, r) => sum + creditBalance(r), 0) - expense.reduce((sum, r) => sum + debitBalance(r), 0);
  const totalEquity = recordedEquity + netIncomeToDate;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
  const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;

  return (
    <div>
      <h2 className="text-lg font-medium">Balance Sheet</h2>
      <p className="mt-2 text-neutral-500">As of today. Assets should equal Liabilities plus Equity.</p>

      <div className="mt-6 grid gap-8 sm:grid-cols-2 tabular-nums">
        <div>
          <h3 className="text-sm font-medium text-neutral-500">Assets</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {assets.map((row) => (
              <li key={row.account.id} className="flex justify-between">
                <span>{row.account.name}</span>
                <span>{formatPrice(debitBalance(row).toFixed(2), "KES")}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 flex justify-between border-t border-border-subtle pt-2 text-sm font-medium">
            <span>Total Assets</span>
            <span>{formatPrice(totalAssets.toFixed(2), "KES")}</span>
          </p>
        </div>

        <div>
          <h3 className="text-sm font-medium text-neutral-500">Liabilities</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {liabilities.map((row) => (
              <li key={row.account.id} className="flex justify-between">
                <span>{row.account.name}</span>
                <span>{formatPrice(creditBalance(row).toFixed(2), "KES")}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 flex justify-between border-t border-border-subtle pt-2 text-sm font-medium">
            <span>Total Liabilities</span>
            <span>{formatPrice(totalLiabilities.toFixed(2), "KES")}</span>
          </p>

          <h3 className="mt-6 text-sm font-medium text-neutral-500">Equity</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {equity.map((row) => (
              <li key={row.account.id} className="flex justify-between">
                <span>{row.account.name}</span>
                <span>{formatPrice(creditBalance(row).toFixed(2), "KES")}</span>
              </li>
            ))}
            <li className="flex justify-between">
              <span>Net income to date</span>
              <span>{formatPrice(netIncomeToDate.toFixed(2), "KES")}</span>
            </li>
          </ul>
          <p className="mt-2 flex justify-between border-t border-border-subtle pt-2 text-sm font-medium">
            <span>Total Equity</span>
            <span>{formatPrice(totalEquity.toFixed(2), "KES")}</span>
          </p>

          <p className="mt-6 flex justify-between border-t border-border-subtle pt-2 text-sm font-medium">
            <span>Total Liabilities + Equity</span>
            <span>{formatPrice(totalLiabilitiesAndEquity.toFixed(2), "KES")}</span>
          </p>
        </div>
      </div>

      <p className={`mt-6 text-sm ${isBalanced ? "text-neutral-500" : "text-red-600"}`}>
        {isBalanced
          ? "Balanced — Assets equal Liabilities plus Equity."
          : "Out of balance — investigate before trusting other reports."}
      </p>
    </div>
  );
}
