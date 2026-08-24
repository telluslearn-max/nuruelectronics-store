import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { createPayRun } from "@/lib/payroll-actions";
import { StatusPill } from "@/components/admin/status-pill";
import { parsePage, type PageSearchParams } from "@/lib/pagination";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { FeedbackBanner } from "@/components/admin/feedback-banner";

export const metadata: Metadata = { title: "Pay Runs" };

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

const inputClass =
  "w-full rounded-control border border-border-subtle px-3 py-2 text-base outline-none focus:border-foreground sm:text-sm";
const primaryButtonClass =
  "rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90";

export default async function AdminPayRunsPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams & { success?: string; error?: string }>;
}) {
  await requireAdminSession();
  const resolvedSearchParams = await searchParams;
  const { success, error } = resolvedSearchParams;
  const { page, skip, take } = parsePage(resolvedSearchParams);

  const [payRuns, totalCount] = await Promise.all([
    prisma.payRun.findMany({
      orderBy: { periodStart: "desc" },
      include: { payslips: true },
      skip,
      take,
    }),
    prisma.payRun.count(),
  ]);

  return (
    <div>
      <h2 className="text-lg font-medium">Pay Runs</h2>
      <FeedbackBanner success={success} error={error} />

      <details className="mt-6" open={payRuns.length === 0}>
        <summary className="cursor-pointer text-sm font-medium">New pay run</summary>
        <form action={createPayRun} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-neutral-500">Period start</label>
            <input type="date" name="periodStart" required className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Period end</label>
            <input type="date" name="periodEnd" required className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className={`${primaryButtonClass} w-full sm:w-auto`}>
              Create pay run
            </button>
          </div>
        </form>
      </details>

      <ul className="mt-6 space-y-3">
        {payRuns.map((payRun) => (
          <li key={payRun.id} className="rounded-card border border-border-subtle p-4 text-sm">
            <Link href={`/admin/payroll/runs/${payRun.id}`} className="flex flex-wrap items-center justify-between gap-3 hover:opacity-80">
              <span>
                <span className="block font-medium">
                  {formatDate(payRun.periodStart)} – {formatDate(payRun.periodEnd)}
                </span>
                <span className="mt-1 block">
                  <StatusPill status={payRun.status} />
                </span>
              </span>
              <span className="text-neutral-500">{payRun.payslips.length} payslip(s)</span>
            </Link>
          </li>
        ))}
        {payRuns.length === 0 && <p className="text-sm text-neutral-500">No pay runs yet.</p>}
      </ul>
      <PaginationControls
        pathname="/admin/payroll/runs"
        searchParams={resolvedSearchParams}
        page={page}
        pageSize={take}
        totalCount={totalCount}
      />
    </div>
  );
}
