import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Chart of Accounts" };

const TYPE_ORDER = ["asset", "liability", "equity", "revenue", "expense"] as const;
const TYPE_LABELS: Record<string, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expenses",
};

export default async function AdminAccountsPage() {
  await requireAdminSession();

  const accounts = await prisma.account.findMany({ orderBy: { code: "asc" } });
  const byType = TYPE_ORDER.map((type) => ({ type, accounts: accounts.filter((a) => a.type === type) }));

  return (
    <div>
      <h2 className="text-lg font-medium">Chart of Accounts</h2>
      <p className="mt-2 text-neutral-500">
        Seeded once via <code>prisma/seed.ts</code> — read-only here.
      </p>

      <div className="mt-6 space-y-8">
        {byType.map(({ type, accounts: typeAccounts }) => (
          <div key={type}>
            <h3 className="text-sm font-medium text-neutral-500">{TYPE_LABELS[type]}</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {typeAccounts.map((account) => (
                <li key={account.id} className="flex justify-between rounded-card border border-border-subtle p-3">
                  <span>{account.name}</span>
                  <span className="text-neutral-500">{account.code}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
