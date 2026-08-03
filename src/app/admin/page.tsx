import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { computePnl } from "@/lib/reports/pnl";
import { getOutstandingInvoices, getOverdueInvoices } from "@/lib/reports/overdue-invoices";
import { getAccountBalances, debitBalance } from "@/lib/reports/ledger-reports";
import { ACCOUNTS } from "@/lib/ledger";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

async function getPettyCashBalance(): Promise<number> {
  const fund = await prisma.pettyCashFund.findFirst();
  if (!fund) return 0;
  const [replenishmentSum, expenseSum] = await Promise.all([
    prisma.pettyCashEntry.aggregate({ where: { fundId: fund.id, type: "replenishment" }, _sum: { amount: true } }),
    prisma.pettyCashEntry.aggregate({ where: { fundId: fund.id, type: "expense" }, _sum: { amount: true } }),
  ]);
  return Number(replenishmentSum._sum.amount ?? 0) - Number(expenseSum._sum.amount ?? 0);
}

export default async function AdminDashboardPage() {
  await requireAdminSession();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [pnl, prevPnl, outstanding, overdue, accountBalances, pettyCashBalance, aiDecisionsThisMonth] = await Promise.all([
    computePnl({ from: monthStart, to: monthEnd, granularity: "monthly" }),
    computePnl({ from: prevMonthStart, to: monthStart, granularity: "monthly" }),
    getOutstandingInvoices(),
    getOverdueInvoices(),
    getAccountBalances(),
    getPettyCashBalance(),
    prisma.returnCase.count({ where: { decidedBy: "agent", createdAt: { gte: monthStart, lt: monthEnd } } }),
  ]);

  const revenueThisMonth = pnl.buckets.reduce((sum, bucket) => sum + (pnl.totalRevenue[bucket] ?? 0), 0);
  const revenueLastMonth = prevPnl.buckets.reduce((sum, bucket) => sum + (prevPnl.totalRevenue[bucket] ?? 0), 0);
  const revenueDeltaPercent =
    revenueLastMonth > 0 ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100 : null;
  const outstandingTotal = outstanding.reduce((sum, invoice) => sum + invoice.balance, 0);
  const overdueTotal = overdue.reduce((sum, invoice) => sum + invoice.balance, 0);

  const cashRow = accountBalances.find((row) => row.account.code === ACCOUNTS.CASH);
  const mpesaRow = accountBalances.find((row) => row.account.code === ACCOUNTS.MPESA);
  const cashPosition = (cashRow ? debitBalance(cashRow) : 0) + (mpesaRow ? debitBalance(mpesaRow) : 0);

  const stats: {
    label: string;
    value: string;
    sub?: string;
    href: string;
    delta?: { text: string; positive: boolean };
  }[] = [
    {
      label: "Revenue this month",
      value: formatPrice(revenueThisMonth.toFixed(2), "KES"),
      href: "/admin/reports/pnl",
      delta:
        revenueDeltaPercent !== null
          ? {
              text: `${revenueDeltaPercent >= 0 ? "+" : ""}${revenueDeltaPercent.toFixed(0)}% vs last month`,
              positive: revenueDeltaPercent >= 0,
            }
          : undefined,
    },
    {
      label: "Outstanding AR",
      value: formatPrice(outstandingTotal.toFixed(2), "KES"),
      sub: `${outstanding.length} invoice(s)`,
      href: "/admin/reports/debtors",
    },
    {
      label: "Overdue invoices",
      value: String(overdue.length),
      sub: overdue.length > 0 ? `${formatPrice(overdueTotal.toFixed(2), "KES")} overdue` : undefined,
      href: "/admin/reports/debtors",
    },
    {
      label: "Cash position",
      value: formatPrice(cashPosition.toFixed(2), "KES"),
      sub: "Cash + M-Pesa",
      href: "/admin/reports/trial-balance",
    },
    { label: "Petty cash balance", value: formatPrice(pettyCashBalance.toFixed(2), "KES"), href: "/admin/petty-cash" },
    {
      label: "AI-decided support cases",
      value: String(aiDecisionsThisMonth),
      sub: "This month, no staff involved",
      href: "/admin/support",
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Dashboard</h2>
        <Link
          href="/admin/orders/new"
          className="rounded-control border border-border-subtle px-4 py-2 text-sm font-medium hover:border-foreground"
        >
          + New manual order
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-card border border-border-subtle p-4 transition hover:border-foreground"
          >
            <p className="text-xs text-neutral-500">{stat.label}</p>
            <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
            {stat.sub && <p className="mt-1 text-xs text-neutral-500">{stat.sub}</p>}
            {stat.delta && (
              <p className={`mt-1 text-xs font-medium ${stat.delta.positive ? "text-green-600" : "text-red-600"}`}>
                {stat.delta.positive ? "▲" : "▼"} {stat.delta.text}
              </p>
            )}
          </Link>
        ))}
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-neutral-500">Overdue invoices</h3>
          {overdue.length > 0 && (
            <Link href="/admin/reports/debtors" className="text-sm underline hover:text-foreground">
              View all
            </Link>
          )}
        </div>
        <ul className="mt-3 space-y-3">
          {overdue.slice(0, 5).map((invoice) => (
            <li key={invoice.id} className="rounded-card border border-border-subtle p-4 text-sm">
              <Link
                href={`/admin/orders/${invoice.orderId}`}
                className="flex flex-wrap items-center justify-between gap-3 hover:opacity-80"
              >
                <span>
                  <span className="block font-medium">{invoice.customerName}</span>
                  <span className="mt-1 block text-neutral-500">
                    {invoice.number}
                    {invoice.dueAt && ` · due ${formatDate(invoice.dueAt)}`}
                  </span>
                </span>
                <span className="text-lg font-semibold">{formatPrice(invoice.balance.toFixed(2), invoice.currencyCode)}</span>
              </Link>
            </li>
          ))}
          {overdue.length === 0 && <p className="text-sm text-neutral-500">No overdue invoices.</p>}
        </ul>
      </div>
    </div>
  );
}
