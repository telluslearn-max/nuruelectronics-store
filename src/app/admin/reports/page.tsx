import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "Reports" };

const REPORT_SECTIONS: { title: string; reports: { href: string; label: string }[] }[] = [
  {
    title: "Financial statements",
    reports: [
      { href: "/admin/reports/pnl", label: "Profit & Loss (Google Sheet sync)" },
      { href: "/admin/reports/income-statement", label: "Income Statement" },
      { href: "/admin/reports/balance-sheet", label: "Balance Sheet" },
      { href: "/admin/reports/trial-balance", label: "Trial Balance" },
    ],
  },
  {
    title: "Registers & ledgers",
    reports: [
      { href: "/admin/reports/sales", label: "Sales Register" },
      { href: "/admin/reports/cash-book", label: "Cash Book" },
      { href: "/admin/reports/debtors", label: "Debtors Ledger" },
      { href: "/admin/reports/creditors", label: "Creditors Ledger" },
      { href: "/admin/reports/tax", label: "Tax Record" },
      { href: "/admin/reports/fixed-assets", label: "Fixed Asset Register" },
      { href: "/admin/reports/payroll", label: "Payroll Register" },
    ],
  },
  {
    title: "Operational insights",
    reports: [
      { href: "/admin/reports/ai-attribution", label: "AI Concierge Attribution" },
      { href: "/admin/reports/riders-impact", label: "Rider Job-Creation Impact" },
    ],
  },
];

export default async function AdminReportsPage() {
  await requireAdminSession();

  return (
    <div>
      <h2 className="text-lg font-medium">Reports</h2>
      <div className="mt-6 space-y-8">
        {REPORT_SECTIONS.map((section) => (
          <div key={section.title}>
            <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">{section.title}</h3>
            <ul className="mt-3 space-y-2">
              {section.reports.map((report) => (
                <li key={report.href}>
                  <Link
                    href={report.href}
                    className="rounded-card border border-border-subtle p-4 text-sm block hover:border-foreground"
                  >
                    {report.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
