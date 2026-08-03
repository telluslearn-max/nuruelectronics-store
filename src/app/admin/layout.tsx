import type { Metadata } from "next";
import Link from "next/link";
import { getAdminSession } from "@/lib/admin-auth";
import { OG_THEME } from "@/lib/og-theme";
import { BottomNav } from "@/components/admin/bottom-nav";
import { SearchForm } from "@/components/admin/search-form";

export const metadata: Metadata = {
  title: {
    default: "Admin",
    template: "%s · Admin",
  },
  robots: { index: false, follow: false },
};

const NAV_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/support", label: "Support" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/documents", label: "Documents" },
  { href: "/admin/receipts", label: "Receipts" },
  { href: "/admin/expenses", label: "Expenses" },
  { href: "/admin/suppliers", label: "Suppliers" },
  { href: "/admin/bills", label: "Bills" },
  { href: "/admin/assets", label: "Fixed Assets" },
  { href: "/admin/petty-cash", label: "Petty Cash" },
  { href: "/admin/payroll/employees", label: "Payroll" },
  { href: "/admin/accounts", label: "Chart of Accounts" },
  { href: "/admin/journal", label: "Journal" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/audit-log", label: "Audit Log" },
  { href: "/admin/settings", label: "Settings" },
];

function BrandMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <rect width="64" height="64" rx="14" fill={OG_THEME.background} />
      <path d="M20 46V18h6l14 19V18h6v28h-6L26 27v19h-6z" fill={OG_THEME.foreground} />
      <rect x="42" y="40" width="6" height="6" fill={OG_THEME.accent} />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Only the login page ever reaches this layout unauthenticated — proxy.ts
  // redirects every other /admin/* request before it gets here, and every
  // other admin page independently calls requireAdminSession() as well.
  const authed = await getAdminSession();

  if (!authed) {
    return <div className="mx-auto max-w-5xl px-6">{children}</div>;
  }

  return (
    <div className="mx-auto max-w-6xl pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-10">
      {/* Compact sticky app bar on mobile */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border-subtle bg-background/95 px-4 py-3 backdrop-blur sm:hidden"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <div className="flex items-center gap-2">
          <BrandMark />
          <span className="text-sm font-semibold">NURU Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/search"
            aria-label="Search"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border-subtle text-neutral-500 transition hover:border-foreground hover:text-foreground"
          >
            <SearchIcon />
          </Link>
          <a
            href="/api/admin/logout"
            aria-label="Log out"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border-subtle text-neutral-500 transition hover:border-foreground hover:text-foreground"
          >
            <LogoutIcon />
          </a>
        </div>
      </div>

      {/* Full header on sm:+ */}
      <div className="hidden items-start justify-between gap-4 border-b border-border-subtle px-6 py-10 pb-6 sm:flex">
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
        <div className="w-64 shrink-0 space-y-3">
          <SearchForm />
          <a
            href="/api/admin/logout"
            className="block w-full rounded-control border border-border-subtle px-4 py-2 text-center text-sm font-medium transition hover:border-foreground"
          >
            Log out
          </a>
        </div>
      </div>

      <div className="admin-content px-4 py-6 sm:px-6 sm:py-0 sm:mt-8">{children}</div>
      <BottomNav />
    </div>
  );
}
