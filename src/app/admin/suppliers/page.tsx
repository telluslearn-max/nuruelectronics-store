import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { createSupplier } from "@/lib/creditor-actions";
import { parsePage, type PageSearchParams } from "@/lib/pagination";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { FeedbackBanner } from "@/components/admin/feedback-banner";

export const metadata: Metadata = { title: "Suppliers" };

const inputClass =
  "w-full rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground";
const primaryButtonClass =
  "rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90";

export default async function AdminSuppliersPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams & { success?: string; error?: string }>;
}) {
  await requireAdminSession();
  const resolvedSearchParams = await searchParams;
  const { success, error } = resolvedSearchParams;
  const { page, skip, take } = parsePage(resolvedSearchParams);

  const [suppliers, totalCount] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { name: "asc" }, skip, take }),
    prisma.supplier.count(),
  ]);

  return (
    <div>
      <h2 className="text-lg font-medium">Suppliers</h2>
      <FeedbackBanner success={success} error={error} />

      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-medium">Add supplier</summary>
        <form action={createSupplier} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-neutral-500">Name</label>
            <input type="text" name="name" required className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Email</label>
            <input type="email" name="email" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Phone</label>
            <input type="text" name="phone" className={inputClass} />
          </div>
          <div className="flex items-end">
            <button type="submit" className={`${primaryButtonClass} w-full sm:w-auto`}>
              Save
            </button>
          </div>
        </form>
      </details>

      <ul className="mt-6 space-y-3">
        {suppliers.map((supplier) => (
          <li key={supplier.id} className="rounded-card border border-border-subtle p-4 text-sm">
            <span className="block font-medium">{supplier.name}</span>
            {(supplier.email || supplier.phone) && (
              <span className="mt-1 block text-neutral-500">
                {[supplier.email, supplier.phone].filter(Boolean).join(" · ")}
              </span>
            )}
          </li>
        ))}
        {suppliers.length === 0 && <p className="text-sm text-neutral-500">No suppliers yet.</p>}
      </ul>
      <PaginationControls
        pathname="/admin/suppliers"
        searchParams={resolvedSearchParams}
        page={page}
        pageSize={take}
        totalCount={totalCount}
      />
    </div>
  );
}
