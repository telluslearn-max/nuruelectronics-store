import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "Reports" };

const REPORTS = [{ href: "/admin/reports/cash-book", label: "Cash Book" }];

export default async function AdminReportsPage() {
  await requireAdminSession();

  return (
    <div>
      <h2 className="text-lg font-medium">Reports</h2>
      <p className="mt-2 text-neutral-500">
        More reports (Sales Register, Debtors, Tax, P&amp;L, Trial Balance) land here as they&apos;re built.
      </p>
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
