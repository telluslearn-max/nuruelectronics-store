import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { createSupplier } from "@/lib/creditor-actions";

export const metadata: Metadata = { title: "Suppliers" };

const inputClass =
  "rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground";
const primaryButtonClass =
  "rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90";

export default async function AdminSuppliersPage() {
  await requireAdminSession();

  const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <h2 className="text-lg font-medium">Suppliers</h2>

      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-medium">Add supplier</summary>
        <form action={createSupplier} className="mt-4 flex flex-wrap items-end gap-3">
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
          <button type="submit" className={primaryButtonClass}>
            Save
          </button>
        </form>
      </details>

      <ul className="mt-6 space-y-2">
        {suppliers.map((supplier) => (
          <li key={supplier.id} className="rounded-card border border-border-subtle p-3 text-sm">
            {supplier.name}
            {supplier.email && ` · ${supplier.email}`}
            {supplier.phone && ` · ${supplier.phone}`}
          </li>
        ))}
        {suppliers.length === 0 && <p className="text-sm text-neutral-500">No suppliers yet.</p>}
      </ul>
    </div>
  );
}
