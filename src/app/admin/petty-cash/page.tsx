import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { createPettyCashFund, replenishPettyCash } from "@/lib/petty-cash-actions";
import { parsePage, type PageSearchParams } from "@/lib/pagination";
import { PaginationControls } from "@/components/admin/pagination-controls";

export const metadata: Metadata = { title: "Petty Cash" };

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

const inputClass =
  "w-full rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground";
const primaryButtonClass =
  "rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90";

export default async function AdminPettyCashPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  await requireAdminSession();
  const resolvedSearchParams = await searchParams;
  const { page, skip, take } = parsePage(resolvedSearchParams);

  const fund = await prisma.pettyCashFund.findFirst();

  if (!fund) {
    return (
      <div>
        <h2 className="text-lg font-medium">Petty Cash</h2>
        <p className="mt-2 text-neutral-500">No petty cash fund yet — set one up with its starting float.</p>
        <form action={createPettyCashFund} className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-neutral-500">Fund name</label>
            <input type="text" name="name" defaultValue="Shop Petty Cash" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Starting float</label>
            <input type="number" step="0.01" name="floatAmount" required className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className={`${primaryButtonClass} w-full sm:w-auto`}>
              Create fund
            </button>
          </div>
        </form>
      </div>
    );
  }

  const [replenishmentSum, expenseSum, entries, totalCount] = await Promise.all([
    prisma.pettyCashEntry.aggregate({
      where: { fundId: fund.id, type: "replenishment" },
      _sum: { amount: true },
    }),
    prisma.pettyCashEntry.aggregate({
      where: { fundId: fund.id, type: "expense" },
      _sum: { amount: true },
    }),
    prisma.pettyCashEntry.findMany({ where: { fundId: fund.id }, orderBy: { date: "desc" }, skip, take }),
    prisma.pettyCashEntry.count({ where: { fundId: fund.id } }),
  ]);
  const balance = Number(replenishmentSum._sum.amount ?? 0) - Number(expenseSum._sum.amount ?? 0);

  return (
    <div>
      <h2 className="text-lg font-medium">{fund.name}</h2>
      <p className="mt-2 text-neutral-500">
        Float {formatPrice(fund.floatAmount.toString(), "KES")} · Current balance {formatPrice(balance.toFixed(2), "KES")}
      </p>

      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-medium">Replenish float</summary>
        <form action={replenishPettyCash.bind(null, fund.id)} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-neutral-500">Amount</label>
            <input type="number" step="0.01" name="amount" required className={inputClass} />
          </div>
          <div className="flex items-end">
            <button type="submit" className={`${primaryButtonClass} w-full sm:w-auto`}>
              Replenish
            </button>
          </div>
        </form>
      </details>

      <p className="mt-6 text-sm text-neutral-500">
        Record petty cash expenses on the <a href="/admin/expenses" className="underline hover:text-foreground">Expenses</a> page
        with &ldquo;Paid from: Petty cash&rdquo;.
      </p>

      <ul className="mt-4 space-y-2">
        {entries.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border-subtle p-4 text-sm">
            <span>
              <span className="block font-medium">{entry.description}</span>
              <span className="mt-1 block text-neutral-500">{formatDate(entry.date)}</span>
            </span>
            <span className="text-lg font-semibold">
              {entry.type === "replenishment" ? "+" : "-"}
              {formatPrice(entry.amount.toString(), "KES")}
            </span>
          </li>
        ))}
        {entries.length === 0 && <p className="text-sm text-neutral-500">No entries yet.</p>}
      </ul>
      <PaginationControls
        pathname="/admin/petty-cash"
        searchParams={resolvedSearchParams}
        page={page}
        pageSize={take}
        totalCount={totalCount}
      />
    </div>
  );
}
