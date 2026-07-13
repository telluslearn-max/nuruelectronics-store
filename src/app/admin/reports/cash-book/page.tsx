import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { ACCOUNTS } from "@/lib/ledger";

export const metadata: Metadata = { title: "Cash Book" };

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

export default async function AdminCashBookPage() {
  await requireAdminSession();

  const lines = await prisma.journalLine.findMany({
    where: { account: { code: { in: [ACCOUNTS.CASH, ACCOUNTS.MPESA] } } },
    include: { account: true, journalEntry: true },
    orderBy: { journalEntry: { date: "asc" } },
  });

  const rows = lines.reduce<
    { id: string; date: Date; description: string; account: string; inflow: number; outflow: number; balance: number }[]
  >((acc, line) => {
    const previousBalance = acc.length > 0 ? acc[acc.length - 1].balance : 0;
    acc.push({
      id: line.id,
      date: line.journalEntry.date,
      description: line.journalEntry.description,
      account: line.account.name,
      inflow: Number(line.debit),
      outflow: Number(line.credit),
      balance: previousBalance + Number(line.debit) - Number(line.credit),
    });
    return acc;
  }, []);

  return (
    <div>
      <h2 className="text-lg font-medium">Cash Book</h2>
      <p className="mt-2 text-neutral-500">Cash on Hand and M-Pesa movements, in date order, with a running balance.</p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
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
