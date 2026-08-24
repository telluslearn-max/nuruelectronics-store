import type { Metadata } from "next";
import Link from "next/link";
import type { BillStatus, Prisma } from "@prisma/client";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { createBill } from "@/lib/creditor-actions";
import { StatusPill } from "@/components/admin/status-pill";
import { parsePage, type PageSearchParams } from "@/lib/pagination";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { FeedbackBanner } from "@/components/admin/feedback-banner";

export const metadata: Metadata = { title: "Bills" };

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

const inputClass =
  "w-full rounded-control border border-border-subtle px-3 py-2 text-base outline-none focus:border-foreground sm:text-sm";
const primaryButtonClass =
  "rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90";

const STATUS_OPTIONS: BillStatus[] = ["unpaid", "partially_paid", "paid"];

function isBillStatus(value: string | undefined): value is BillStatus {
  return value !== undefined && (STATUS_OPTIONS as string[]).includes(value);
}

export default async function AdminBillsPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams & { status?: string; success?: string; error?: string }>;
}) {
  await requireAdminSession();
  const resolvedSearchParams = await searchParams;
  const { success, error } = resolvedSearchParams;
  const { page, skip, take } = parsePage(resolvedSearchParams);
  const statusFilter = isBillStatus(resolvedSearchParams.status) ? resolvedSearchParams.status : undefined;
  const where: Prisma.BillWhereInput = statusFilter ? { status: statusFilter } : {};

  const [bills, totalCount, suppliers] = await Promise.all([
    prisma.bill.findMany({ where, orderBy: { billDate: "desc" }, include: { supplier: true }, skip, take }),
    prisma.bill.count({ where }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h2 className="text-lg font-medium">Bills</h2>
      <FeedbackBanner success={success} error={error} />

      <details className="mt-6" open={suppliers.length > 0 && bills.length === 0}>
        <summary className="cursor-pointer text-sm font-medium">New bill</summary>
        {suppliers.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            Add a <Link href="/admin/suppliers" className="underline hover:text-foreground">supplier</Link> first.
          </p>
        ) : (
          <form action={createBill} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-neutral-500">Supplier</label>
              <select name="supplierId" required className={inputClass}>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-500">Description</label>
              <input type="text" name="description" required className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-neutral-500">Category</label>
              <select name="category" required className={inputClass}>
                <option value="cogs">COGS</option>
                <option value="sga">SG&amp;A</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-500">Amount</label>
              <input type="number" step="0.01" name="amount" required className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-neutral-500">Bill date</label>
              <input type="date" name="billDate" required className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-neutral-500">Due date</label>
              <input type="date" name="dueAt" className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className={`${primaryButtonClass} w-full sm:w-auto`}>
                Create bill
              </button>
            </div>
          </form>
        )}
      </details>

      <form method="GET" className="mt-6 flex items-end gap-3">
        <div>
          <label className="block text-xs text-neutral-500">Status</label>
          <select name="status" defaultValue={statusFilter ?? ""} className={inputClass}>
            <option value="">All</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-control border border-border-subtle px-4 py-2 text-sm font-medium hover:border-foreground">
          Filter
        </button>
      </form>

      <ul className="mt-6 space-y-3">
        {bills.map((bill) => (
          <li key={bill.id} className="rounded-card border border-border-subtle p-4 text-sm">
            <Link href={`/admin/bills/${bill.id}`} className="flex flex-wrap items-center justify-between gap-3 hover:opacity-80">
              <span>
                <span className="block font-medium">{bill.number}</span>
                <span className="mt-1 flex items-center gap-2">
                  <StatusPill status={bill.status} />
                  <span className="text-neutral-500">{formatDate(bill.billDate)}</span>
                </span>
              </span>
              <span className="text-right">
                <span className="block font-medium">{bill.supplier.name}</span>
                <span className="mt-1 block text-lg font-semibold">{formatPrice(bill.amount.toString(), "KES")}</span>
                <span className="block text-xs text-neutral-500">
                  paid {formatPrice(bill.amountPaid.toString(), "KES")}
                </span>
              </span>
            </Link>
          </li>
        ))}
        {bills.length === 0 && <p className="text-sm text-neutral-500">No bills yet.</p>}
      </ul>
      <PaginationControls
        pathname="/admin/bills"
        searchParams={resolvedSearchParams}
        page={page}
        pageSize={take}
        totalCount={totalCount}
      />
    </div>
  );
}
