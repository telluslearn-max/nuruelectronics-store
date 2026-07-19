import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { getAccountBalances } from "@/lib/reports/ledger-reports";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Trial Balance" };

export default async function AdminTrialBalancePage() {
  await requireAdminSession();

  const rows = await getAccountBalances();
  const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div>
      <h2 className="text-lg font-medium">Trial Balance</h2>
      <p className="mt-2 text-neutral-500">As of today. Total debits should equal total credits.</p>

      <ul className="mt-6 space-y-3 sm:hidden">
        {rows.map((row) => (
          <li key={row.account.id} className="rounded-card border border-border-subtle p-4 text-sm">
            <span className="block font-medium">
              {row.account.code} {row.account.name}
            </span>
            <span className="mt-1 flex justify-between text-neutral-500">
              <span>Debit {row.debit > 0 ? formatPrice(row.debit.toFixed(2), "KES") : "—"}</span>
              <span>Credit {row.credit > 0 ? formatPrice(row.credit.toFixed(2), "KES") : "—"}</span>
            </span>
          </li>
        ))}
        {rows.length === 0 && <p className="text-sm text-neutral-500">No ledger activity yet.</p>}
        {rows.length > 0 && (
          <li className="flex justify-between rounded-card border border-foreground p-4 text-sm font-medium">
            <span>Total</span>
            <span>
              {formatPrice(totalDebit.toFixed(2), "KES")} / {formatPrice(totalCredit.toFixed(2), "KES")}
            </span>
          </li>
        )}
      </ul>

      <div className="mt-6 hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs text-neutral-500">
              <th className="py-2">Account</th>
              <th className="py-2 text-right">Debit</th>
              <th className="py-2 text-right">Credit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.account.id} className="border-b border-border-subtle/60">
                <td className="py-2">
                  {row.account.code} {row.account.name}
                </td>
                <td className="py-2 text-right">{row.debit > 0 ? formatPrice(row.debit.toFixed(2), "KES") : ""}</td>
                <td className="py-2 text-right">{row.credit > 0 ? formatPrice(row.credit.toFixed(2), "KES") : ""}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-neutral-500">
                  No ledger activity yet.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="font-medium">
                <td className="py-2">Total</td>
                <td className="py-2 text-right">{formatPrice(totalDebit.toFixed(2), "KES")}</td>
                <td className="py-2 text-right">{formatPrice(totalCredit.toFixed(2), "KES")}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {rows.length > 0 && (
        <p className={`mt-4 text-sm ${isBalanced ? "text-neutral-500" : "text-red-600"}`}>
          {isBalanced ? "Ledger is balanced." : "Ledger is out of balance — investigate before trusting other reports."}
        </p>
      )}
    </div>
  );
}
