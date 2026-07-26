import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { formatPrice } from "@/lib/format";
import { getPayrollReport } from "@/lib/reports/payroll-report";
import { parsePage, type PageSearchParams } from "@/lib/pagination";
import { PaginationControls } from "@/components/admin/pagination-controls";

export const metadata: Metadata = { title: "Payroll Register" };

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

export default async function AdminPayrollRegisterPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams & { from?: string; to?: string }>;
}) {
  await requireAdminSession();
  const resolvedSearchParams = await searchParams;
  const { from, to } = resolvedSearchParams;
  const { page, skip, take } = parsePage(resolvedSearchParams);

  const { rows: payslips, totalCount } = await getPayrollReport({
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    skip,
    take,
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Payroll Register</h2>
        <a
          href="/api/reports/payroll/csv"
          className="rounded-control border border-border-subtle px-4 py-2 text-sm font-medium hover:border-foreground"
        >
          Export CSV
        </a>
      </div>
      <p className="mt-2 text-neutral-500">All payslips across pay runs.</p>

      <form method="GET" className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-neutral-500">Period from</label>
          <input
            type="date"
            name="from"
            defaultValue={from ?? ""}
            className="w-full rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Period to</label>
          <input
            type="date"
            name="to"
            defaultValue={to ?? ""}
            className="w-full rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground"
          />
        </div>
        <button type="submit" className="rounded-control border border-border-subtle px-4 py-2 text-sm font-medium hover:border-foreground">
          Filter
        </button>
        {(from || to) && (
          <a href="/admin/reports/payroll" className="text-sm text-neutral-500 underline hover:text-foreground">
            Clear
          </a>
        )}
      </form>

      <ul className="mt-6 space-y-3 sm:hidden">
        {payslips.map((payslip) => (
          <li key={payslip.id} className="rounded-card border border-border-subtle p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span>
                <span className="block font-medium">{payslip.employeeName}</span>
                <span className="mt-1 block text-neutral-500">
                  {payslip.number} · {formatDate(payslip.periodStart)} – {formatDate(payslip.periodEnd)}
                </span>
              </span>
              <span className="text-lg font-semibold">{formatPrice(payslip.netPay.toFixed(2), "KES")}</span>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              Gross {formatPrice(payslip.grossPay.toFixed(2), "KES")} · Deductions{" "}
              {formatPrice(payslip.totalDeductions.toFixed(2), "KES")}
            </p>
          </li>
        ))}
        {payslips.length === 0 && (
          <p className="text-sm text-neutral-500">{from || to ? "No payslips match this filter." : "No payslips yet."}</p>
        )}
      </ul>

      <div className="mt-6 hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[720px] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs text-neutral-500">
              <th className="py-2">Payslip</th>
              <th className="py-2">Employee</th>
              <th className="py-2">Period</th>
              <th className="py-2 text-right">Gross</th>
              <th className="py-2 text-right">Deductions</th>
              <th className="py-2 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {payslips.map((payslip) => (
              <tr key={payslip.id} className="border-b border-border-subtle/60">
                <td className="py-2">{payslip.number}</td>
                <td className="py-2">{payslip.employeeName}</td>
                <td className="py-2">
                  {formatDate(payslip.periodStart)} – {formatDate(payslip.periodEnd)}
                </td>
                <td className="py-2 text-right">{formatPrice(payslip.grossPay.toFixed(2), "KES")}</td>
                <td className="py-2 text-right">{formatPrice(payslip.totalDeductions.toFixed(2), "KES")}</td>
                <td className="py-2 text-right">{formatPrice(payslip.netPay.toFixed(2), "KES")}</td>
              </tr>
            ))}
            {payslips.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-neutral-500">
                  {from || to ? "No payslips match this filter." : "No payslips yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls
        pathname="/admin/reports/payroll"
        searchParams={resolvedSearchParams}
        page={page}
        pageSize={take}
        totalCount={totalCount}
      />
    </div>
  );
}
