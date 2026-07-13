import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { getAccountBalancesForPeriod, creditBalance, debitBalance } from "@/lib/reports/ledger-reports";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Income Statement" };

function startOfYear(): Date {
  return new Date(new Date().getFullYear(), 0, 1);
}

function startOfNextYear(): Date {
  return new Date(new Date().getFullYear() + 1, 0, 1);
}

export default async function AdminIncomeStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireAdminSession();
  const { from: fromParam, to: toParam } = await searchParams;

  const from = fromParam ? new Date(fromParam) : startOfYear();
  const to = toParam ? new Date(toParam) : startOfNextYear();

  const rows = await getAccountBalancesForPeriod({ from, to });
  const revenue = rows.filter((r) => r.account.type === "revenue");
  const expense = rows.filter((r) => r.account.type === "expense");

  const totalRevenue = revenue.reduce((sum, r) => sum + creditBalance(r), 0);
  const totalExpense = expense.reduce((sum, r) => sum + debitBalance(r), 0);
  const netIncome = totalRevenue - totalExpense;

  return (
    <div>
      <h2 className="text-lg font-medium">Income Statement</h2>
      <p className="mt-2 text-neutral-500">
        Accrual basis — the ledger&apos;s real profit for the period, distinct from the cash-basis P&amp;L sheet
        export.
      </p>

      <form className="mt-4 flex flex-wrap items-end gap-3 text-sm">
        <div>
          <label className="block text-xs text-neutral-500">From</label>
          <input
            type="date"
            name="from"
            defaultValue={from.toISOString().slice(0, 10)}
            className="rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">To</label>
          <input
            type="date"
            name="to"
            defaultValue={to.toISOString().slice(0, 10)}
            className="rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground"
          />
        </div>
        <button
          type="submit"
          className="rounded-control border border-border-subtle px-4 py-2 text-sm font-medium hover:border-foreground"
        >
          Update
        </button>
      </form>

      <div className="mt-6 space-y-6">
        <div>
          <h3 className="text-sm font-medium text-neutral-500">Revenue</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {revenue.map((row) => (
              <li key={row.account.id} className="flex justify-between">
                <span>{row.account.name}</span>
                <span>{formatPrice(creditBalance(row).toFixed(2), "KES")}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 flex justify-between border-t border-border-subtle pt-2 text-sm font-medium">
            <span>Total Revenue</span>
            <span>{formatPrice(totalRevenue.toFixed(2), "KES")}</span>
          </p>
        </div>

        <div>
          <h3 className="text-sm font-medium text-neutral-500">Expenses</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {expense.map((row) => (
              <li key={row.account.id} className="flex justify-between">
                <span>{row.account.name}</span>
                <span>{formatPrice(debitBalance(row).toFixed(2), "KES")}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 flex justify-between border-t border-border-subtle pt-2 text-sm font-medium">
            <span>Total Expenses</span>
            <span>{formatPrice(totalExpense.toFixed(2), "KES")}</span>
          </p>
        </div>

        <p className="flex justify-between border-t border-foreground pt-3 text-base font-medium">
          <span>Net Income</span>
          <span>{formatPrice(netIncome.toFixed(2), "KES")}</span>
        </p>
      </div>
    </div>
  );
}
