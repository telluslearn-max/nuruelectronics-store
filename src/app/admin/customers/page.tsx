import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { parsePage, type PageSearchParams } from "@/lib/pagination";
import { PaginationControls } from "@/components/admin/pagination-controls";
import type { Prisma } from "@prisma/client";

export const metadata: Metadata = { title: "Customers" };

const inputClass =
  "w-full rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams & { q?: string }>;
}) {
  await requireAdminSession();
  const resolvedSearchParams = await searchParams;
  const { page, skip, take } = parsePage(resolvedSearchParams);
  const q = resolvedSearchParams.q?.trim();

  const where: Prisma.CustomerWhereInput = q
    ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }
    : {};

  const [customers, totalCount] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { orders: true } } },
      skip,
      take,
    }),
    prisma.customer.count({ where }),
  ]);

  const withTotals = await Promise.all(
    customers.map(async (customer) => {
      const agg = await prisma.invoice.aggregate({
        where: { order: { customerId: customer.id } },
        _sum: { total: true },
      });
      return { customer, lifetimeInvoiced: Number(agg._sum.total ?? 0) };
    }),
  );

  return (
    <div>
      <h2 className="text-lg font-medium">Customers</h2>

      <form method="GET" className="mt-6 flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs text-neutral-500">Search</label>
          <input type="text" name="q" defaultValue={q ?? ""} placeholder="Name or email" className={inputClass} />
        </div>
        <button type="submit" className="rounded-control border border-border-subtle px-4 py-2 text-sm font-medium hover:border-foreground">
          Search
        </button>
      </form>

      <ul className="mt-6 space-y-3">
        {withTotals.map(({ customer, lifetimeInvoiced }) => (
          <li key={customer.id} className="rounded-card border border-border-subtle p-4 text-sm">
            <Link
              href={`/admin/customers/${customer.id}`}
              className="flex flex-wrap items-center justify-between gap-3 hover:opacity-80"
            >
              <span>
                <span className="block font-medium">{customer.name ?? customer.email}</span>
                {customer.name && <span className="mt-1 block text-neutral-500">{customer.email}</span>}
                <span className="mt-1 block text-neutral-500">{customer._count.orders} order(s)</span>
              </span>
              <span className="text-lg font-semibold">{formatPrice(lifetimeInvoiced.toFixed(2), "KES")}</span>
            </Link>
          </li>
        ))}
        {customers.length === 0 && (
          <p className="text-sm text-neutral-500">{q ? "No customers match this search." : "No customers yet."}</p>
        )}
      </ul>
      <PaginationControls
        pathname="/admin/customers"
        searchParams={resolvedSearchParams}
        page={page}
        pageSize={take}
        totalCount={totalCount}
      />
    </div>
  );
}
