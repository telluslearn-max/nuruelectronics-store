import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { createExpense } from "@/lib/expense-actions";

export const metadata: Metadata = { title: "Expenses" };

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

const inputClass =
  "w-full rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground";
const primaryButtonClass =
  "rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90";

export default async function AdminExpensesPage() {
  await requireAdminSession();

  const expenses = await prisma.expense.findMany({ orderBy: { date: "desc" }, take: 200 });

  return (
    <div>
      <h2 className="text-lg font-medium">Expenses</h2>
      <p className="mt-2 text-neutral-500">
        Feeds the Expenses side of the P&amp;L (COGS / SG&amp;A / Other) and the Cash Book.
      </p>

      <details className="mt-6" open={expenses.length === 0}>
        <summary className="cursor-pointer text-sm font-medium">Record expense</summary>
        <form action={createExpense} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-neutral-500">Date</label>
            <input type="date" name="date" required className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Category</label>
            <select name="category" required className={inputClass}>
              <option value="cogs">COGS</option>
              <option value="sga">SG&amp;A</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Subcategory</label>
            <input
              type="text"
              name="subcategory"
              required
              placeholder="Personnel, Software Subscriptions, Rent…"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Amount</label>
            <input type="number" step="0.01" name="amount" required className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Paid from</label>
            <select name="paidFrom" required className={inputClass}>
              <option value="cash">Cash</option>
              <option value="mpesa">M-Pesa</option>
              <option value="petty_cash">Petty cash</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Description</label>
            <input type="text" name="description" className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className={`${primaryButtonClass} w-full sm:w-auto`}>
              Save
            </button>
          </div>
        </form>
      </details>

      <ul className="mt-6 space-y-3">
        {expenses.map((expense) => (
          <li key={expense.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border-subtle p-4 text-sm">
            <span>
              <span className="block font-medium">
                {expense.category.toUpperCase()} · {expense.subcategory}
              </span>
              <span className="mt-1 block text-neutral-500">
                {formatDate(expense.date)}
                {expense.description ? ` · ${expense.description}` : ""}
              </span>
            </span>
            <span className="text-right">
              <span className="block text-lg font-semibold">{formatPrice(expense.amount.toString(), "KES")}</span>
              <span className="block text-xs text-neutral-500">{expense.paidFrom.replace("_", " ")}</span>
            </span>
          </li>
        ))}
        {expenses.length === 0 && <p className="text-sm text-neutral-500">No expenses recorded yet.</p>}
      </ul>
    </div>
  );
}
