import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "More" };

const LINKS = [
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/support", label: "Support" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/receipts", label: "Receipts" },
  { href: "/admin/gift-cards", label: "Gift Cards" },
  { href: "/admin/gift-card-checkouts", label: "Gift Card Checkouts" },
  { href: "/admin/expenses", label: "Expenses" },
  { href: "/admin/suppliers", label: "Suppliers" },
  { href: "/admin/bills", label: "Bills" },
  { href: "/admin/assets", label: "Fixed Assets" },
  { href: "/admin/petty-cash", label: "Petty Cash" },
  { href: "/admin/payroll/employees", label: "Payroll" },
  { href: "/admin/accounts", label: "Chart of Accounts" },
  { href: "/admin/journal", label: "Journal" },
  { href: "/admin/audit-log", label: "Audit Log" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminMorePage() {
  await requireAdminSession();

  return (
    <div>
      <h2 className="text-lg font-medium">More</h2>
      <ul className="mt-6 space-y-3">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="flex items-center justify-between rounded-card border border-border-subtle p-4 text-sm font-medium transition hover:border-foreground"
            >
              {link.label}
              <span aria-hidden="true" className="text-neutral-400">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
