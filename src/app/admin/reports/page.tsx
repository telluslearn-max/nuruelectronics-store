import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "Reports" };

const REPORTS = [
  { href: "/admin/reports/sales", label: "Sales Register" },
  { href: "/admin/reports/cash-book", label: "Cash Book" },
  { href: "/admin/reports/debtors", label: "Debtors Ledger" },
  { href: "/admin/reports/creditors", label: "Creditors Ledger" },
  { href: "/admin/reports/tax", label: "Tax Record" },
  { href: "/admin/reports/fixed-assets", label: "Fixed Asset Register" },
  { href: "/admin/reports/payroll", label: "Payroll Register" },
  { href: "/admin/reports/trial-balance", label: "Trial Balance" },
  { href: "/admin/reports/balance-sheet", label: "Balance Sheet" },
  { href: "/admin/reports/income-statement", label: "Income Statement" },
];

export default async function AdminReportsPage() {
  await requireAdminSession();

  return (
    <div>
      <h2 className="text-lg font-medium">Reports</h2>
      <p className="mt-2 text-neutral-500">The Google Sheet P&amp;L sync lands here too, once built.</p>
      <ul className="mt-6 space-y-2">
        {REPORTS.map((report) => (
          <li key={report.href}>
            <Link href={report.href} className="rounded-card border border-border-subtle p-4 text-sm block hover:border-foreground">
              {report.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
