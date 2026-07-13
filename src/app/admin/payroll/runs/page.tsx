import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { createPayRun } from "@/lib/payroll-actions";

export const metadata: Metadata = { title: "Pay Runs" };

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

const inputClass =
  "rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground";
const primaryButtonClass =
  "rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90";

export default async function AdminPayRunsPage() {
  await requireAdminSession();

  const payRuns = await prisma.payRun.findMany({
    orderBy: { periodStart: "desc" },
    include: { payslips: true },
  });

  return (
    <div>
      <h2 className="text-lg font-medium">Pay Runs</h2>

      <details className="mt-6" open={payRuns.length === 0}>
        <summary className="cursor-pointer text-sm font-medium">New pay run</summary>
        <form action={createPayRun} className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-neutral-500">Period start</label>
            <input type="date" name="periodStart" required className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Period end</label>
            <input type="date" name="periodEnd" required className={inputClass} />
          </div>
          <button type="submit" className={primaryButtonClass}>
            Create pay run
          </button>
        </form>
      </details>

      <ul className="mt-6 space-y-3">
        {payRuns.map((payRun) => (
          <li key={payRun.id} className="rounded-card border border-border-subtle p-4 text-sm">
            <Link href={`/admin/payroll/runs/${payRun.id}`} className="flex flex-wrap items-center justify-between gap-2 hover:underline">
              <span>
                {formatDate(payRun.periodStart)} – {formatDate(payRun.periodEnd)}
              </span>
              <span className="text-neutral-500">
                {payRun.status} · {payRun.payslips.length} payslip(s)
              </span>
            </Link>
          </li>
        ))}
        {payRuns.length === 0 && <p className="text-sm text-neutral-500">No pay runs yet.</p>}
      </ul>
    </div>
  );
}
