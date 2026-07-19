import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { createEmployee } from "@/lib/payroll-actions";
import { parsePage, type PageSearchParams } from "@/lib/pagination";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { FeedbackBanner } from "@/components/admin/feedback-banner";

export const metadata: Metadata = { title: "Employees" };

const inputClass =
  "w-full rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground";
const primaryButtonClass =
  "rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90";

export default async function AdminEmployeesPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams & { success?: string; error?: string }>;
}) {
  await requireAdminSession();
  const resolvedSearchParams = await searchParams;
  const { success, error } = resolvedSearchParams;
  const { page, skip, take } = parsePage(resolvedSearchParams);

  const [employees, totalCount] = await Promise.all([
    prisma.employee.findMany({ orderBy: { name: "asc" }, skip, take }),
    prisma.employee.count(),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Employees</h2>
        <Link href="/admin/payroll/runs" className="rounded-control border border-border-subtle px-4 py-2 text-sm font-medium hover:border-foreground">
          Pay runs
        </Link>
      </div>
      <FeedbackBanner success={success} error={error} />

      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-medium">Add employee</summary>
        <form action={createEmployee} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-neutral-500">Name</label>
            <input type="text" name="name" required className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Role</label>
            <input type="text" name="role" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Email</label>
            <input type="email" name="email" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Phone</label>
            <input type="text" name="phone" className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className={`${primaryButtonClass} w-full sm:w-auto`}>
              Save
            </button>
          </div>
        </form>
      </details>

      <ul className="mt-6 space-y-3">
        {employees.map((employee) => (
          <li key={employee.id} className="rounded-card border border-border-subtle p-4 text-sm">
            <span className="block font-medium">
              {employee.name}
              {!employee.active && <span className="ml-2 text-xs font-normal text-neutral-500">(inactive)</span>}
            </span>
            {(employee.role || employee.email) && (
              <span className="mt-1 block text-neutral-500">
                {[employee.role, employee.email].filter(Boolean).join(" · ")}
              </span>
            )}
          </li>
        ))}
        {employees.length === 0 && <p className="text-sm text-neutral-500">No employees yet.</p>}
      </ul>
      <PaginationControls
        pathname="/admin/payroll/employees"
        searchParams={resolvedSearchParams}
        page={page}
        pageSize={take}
        totalCount={totalCount}
      />
    </div>
  );
}
