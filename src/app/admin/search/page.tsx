import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { SearchForm } from "@/components/admin/search-form";

export const metadata: Metadata = { title: "Search" };

const RESULT_LIMIT = 10;

type SearchResult = { label: string; sub?: string; href: string };
type SearchGroup = { type: string; results: SearchResult[] };

async function search(q: string): Promise<SearchGroup[]> {
  const contains = { contains: q, mode: "insensitive" as const };

  const [customers, orders, invoices, estimates, deliveryNotes, suppliers, bills, employees] = await Promise.all([
    prisma.customer.findMany({
      where: { OR: [{ name: contains }, { email: contains }] },
      take: RESULT_LIMIT,
    }),
    prisma.order.findMany({
      where: { OR: [{ shopifyOrderName: contains }, { note: contains }] },
      include: { customer: true },
      take: RESULT_LIMIT,
    }),
    prisma.invoice.findMany({
      where: { number: contains },
      include: { order: { include: { customer: true } } },
      take: RESULT_LIMIT,
    }),
    prisma.estimate.findMany({
      where: { number: contains },
      include: { order: { include: { customer: true } } },
      take: RESULT_LIMIT,
    }),
    prisma.deliveryNote.findMany({
      where: { OR: [{ number: contains }, { recipientName: contains }] },
      take: RESULT_LIMIT,
    }),
    prisma.supplier.findMany({ where: { name: contains }, take: RESULT_LIMIT }),
    prisma.bill.findMany({ where: { number: contains }, include: { supplier: true }, take: RESULT_LIMIT }),
    prisma.employee.findMany({ where: { name: contains }, take: RESULT_LIMIT }),
  ]);

  const groups: SearchGroup[] = [
    {
      type: "Customers",
      results: customers.map((c) => ({ label: c.name ?? c.email, sub: c.email, href: `/admin/customers/${c.id}` })),
    },
    {
      type: "Orders",
      results: orders.map((o) => ({
        label: o.shopifyOrderName ?? `Order ${o.id.slice(0, 8)}`,
        sub: o.customer.name ?? o.customer.email,
        href: `/admin/orders/${o.id}`,
      })),
    },
    {
      type: "Invoices",
      results: invoices.map((i) => ({
        label: i.number,
        sub: i.order.customer.name ?? i.order.customer.email,
        href: `/admin/orders/${i.orderId}`,
      })),
    },
    {
      type: "Estimates",
      results: estimates.map((e) => ({
        label: e.number,
        sub: e.order.customer.name ?? e.order.customer.email,
        href: `/admin/orders/${e.orderId}`,
      })),
    },
    {
      type: "Delivery notes",
      results: deliveryNotes.map((d) => ({
        label: d.number,
        sub: d.recipientName,
        href: `/admin/orders/${d.orderId}`,
      })),
    },
    {
      type: "Suppliers",
      results: suppliers.map((s) => ({ label: s.name, sub: s.email ?? s.phone ?? undefined, href: "/admin/suppliers" })),
    },
    {
      type: "Bills",
      results: bills.map((b) => ({ label: b.number, sub: b.supplier.name, href: `/admin/bills/${b.id}` })),
    },
    {
      type: "Employees",
      results: employees.map((e) => ({ label: e.name, sub: e.role ?? undefined, href: "/admin/payroll/employees" })),
    },
  ];

  return groups.filter((group) => group.results.length > 0);
}

export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdminSession();
  const { q: rawQ } = await searchParams;
  const q = rawQ?.trim();

  const groups = q ? await search(q) : [];
  const hasResults = groups.some((group) => group.results.length > 0);

  return (
    <div>
      <h2 className="text-lg font-medium">Search</h2>
      <div className="mt-6">
        <SearchForm q={q} />
      </div>

      {q && !hasResults && <p className="mt-6 text-sm text-neutral-500">No results for &ldquo;{q}&rdquo;.</p>}

      <div className="mt-6 space-y-8">
        {groups.map((group) => (
          <div key={group.type}>
            <h3 className="text-sm font-medium text-neutral-500">{group.type}</h3>
            <ul className="mt-3 space-y-3">
              {group.results.map((result) => (
                <li key={result.href + result.label} className="rounded-card border border-border-subtle p-4 text-sm">
                  <Link href={result.href} className="flex flex-wrap items-center justify-between gap-3 hover:opacity-80">
                    <span className="block font-medium">{result.label}</span>
                    {result.sub && <span className="text-neutral-500">{result.sub}</span>}
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
