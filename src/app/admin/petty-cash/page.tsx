import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { createPettyCashFund, replenishPettyCash } from "@/lib/petty-cash-actions";

export const metadata: Metadata = { title: "Petty Cash" };

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

const inputClass =
  "rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground";
const primaryButtonClass =
  "rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90";

export default async function AdminPettyCashPage() {
  await requireAdminSession();

  const fund = await prisma.pettyCashFund.findFirst({
    include: { entries: { orderBy: { date: "desc" } } },
  });

  if (!fund) {
    return (
      <div>
        <h2 className="text-lg font-medium">Petty Cash</h2>
        <p className="mt-2 text-neutral-500">No petty cash fund yet — set one up with its starting float.</p>
        <form action={createPettyCashFund} className="mt-6 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-neutral-500">Fund name</label>
            <input type="text" name="name" defaultValue="Shop Petty Cash" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Starting float</label>
            <input type="number" step="0.01" name="floatAmount" required className={inputClass} />
          </div>
          <button type="submit" className={primaryButtonClass}>
            Create fund
          </button>
        </form>
      </div>
    );
  }

  const balance = fund.entries.reduce(
    (sum, entry) => sum + (entry.type === "replenishment" ? Number(entry.amount) : -Number(entry.amount)),
    0,
  );

  return (
    <div>
      <h2 className="text-lg font-medium">{fund.name}</h2>
      <p className="mt-2 text-neutral-500">
        Float {formatPrice(fund.floatAmount.toString(), "KES")} · Current balance {formatPrice(balance.toFixed(2), "KES")}
      </p>

      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-medium">Replenish float</summary>
        <form action={replenishPettyCash.bind(null, fund.id)} className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-neutral-500">Amount</label>
            <input type="number" step="0.01" name="amount" required className={inputClass} />
          </div>
          <button type="submit" className={primaryButtonClass}>
            Replenish
          </button>
        </form>
      </details>

      <p className="mt-6 text-sm text-neutral-500">
        Record petty cash expenses on the <a href="/admin/expenses" className="underline hover:text-foreground">Expenses</a> page
        with &ldquo;Paid from: Petty cash&rdquo;.
      </p>

      <ul className="mt-4 space-y-2">
        {fund.entries.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border-subtle p-3 text-sm">
            <span>
              {formatDate(entry.date)} · {entry.description}
            </span>
            <span className={entry.type === "replenishment" ? "text-neutral-500" : "text-neutral-800"}>
              {entry.type === "replenishment" ? "+" : "-"}
              {formatPrice(entry.amount.toString(), "KES")}
            </span>
          </li>
        ))}
        {fund.entries.length === 0 && <p className="text-sm text-neutral-500">No entries yet.</p>}
      </ul>
    </div>
  );
}
