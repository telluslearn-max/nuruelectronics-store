import type { Metadata } from "next";
import Link from "next/link";
import { getAdminSession } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: {
    default: "Admin",
    template: "%s · Admin",
  },
  robots: { index: false, follow: false },
};

const NAV_LINKS = [
  { href: "/admin", label: "Orders" },
  { href: "/admin/estimates", label: "Estimates" },
  { href: "/admin/invoices", label: "Invoices" },
  { href: "/admin/receipts", label: "Receipts" },
  { href: "/admin/delivery-notes", label: "Delivery Notes" },
  { href: "/admin/expenses", label: "Expenses" },
  { href: "/admin/suppliers", label: "Suppliers" },
  { href: "/admin/bills", label: "Bills" },
  { href: "/admin/assets", label: "Fixed Assets" },
  { href: "/admin/petty-cash", label: "Petty Cash" },
  { href: "/admin/payroll/employees", label: "Payroll" },
  { href: "/admin/accounts", label: "Chart of Accounts" },
  { href: "/admin/journal", label: "Journal" },
  { href: "/admin/reports", label: "Reports" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Only the login page ever reaches this layout unauthenticated — proxy.ts
  // redirects every other /admin/* request before it gets here, and every
  // other admin page independently calls requireAdminSession() as well.
  const authed = await getAdminSession();

  if (!authed) {
    return <div className="mx-auto max-w-5xl px-6">{children}</div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-start justify-between gap-4 border-b border-border-subtle pb-6">
        <div>
          <h1 className="text-title">Nuru Admin</h1>
          <nav className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-neutral-600">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-foreground hover:underline">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <a
          href="/api/admin/logout"
          className="shrink-0 rounded-control border border-border-subtle px-4 py-2 text-sm font-medium transition hover:border-foreground"
        >
          Log out
        </a>
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}
