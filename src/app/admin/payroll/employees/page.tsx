import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { createEmployee } from "@/lib/payroll-actions";

export const metadata: Metadata = { title: "Employees" };

const inputClass =
  "rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground";
const primaryButtonClass =
  "rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90";

export default async function AdminEmployeesPage() {
  await requireAdminSession();

  const employees = await prisma.employee.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Employees</h2>
        <Link href="/admin/payroll/runs" className="rounded-control border border-border-subtle px-4 py-2 text-sm font-medium hover:border-foreground">
          Pay runs
        </Link>
      </div>

      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-medium">Add employee</summary>
        <form action={createEmployee} className="mt-4 flex flex-wrap items-end gap-3">
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
          <button type="submit" className={primaryButtonClass}>
            Save
          </button>
        </form>
      </details>

      <ul className="mt-6 space-y-2">
        {employees.map((employee) => (
          <li key={employee.id} className="rounded-card border border-border-subtle p-3 text-sm">
            {employee.name}
            {employee.role && ` · ${employee.role}`}
            {employee.email && ` · ${employee.email}`}
            {!employee.active && " · inactive"}
          </li>
        ))}
        {employees.length === 0 && <p className="text-sm text-neutral-500">No employees yet.</p>}
      </ul>
    </div>
  );
}
