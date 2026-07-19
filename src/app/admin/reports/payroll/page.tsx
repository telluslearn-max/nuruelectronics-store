import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Payroll Register" };

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

export default async function AdminPayrollRegisterPage() {
  await requireAdminSession();

  const payslips = await prisma.payslip.findMany({
    orderBy: { createdAt: "desc" },
    include: { employee: true, payRun: true, deductions: true },
  });

  return (
    <div>
      <h2 className="text-lg font-medium">Payroll Register</h2>
      <p className="mt-2 text-neutral-500">All payslips across pay runs.</p>

      <ul className="mt-6 space-y-3 sm:hidden">
        {payslips.map((payslip) => {
          const totalDeductions = payslip.deductions.reduce((sum, d) => sum + Number(d.amount), 0);
          return (
            <li key={payslip.id} className="rounded-card border border-border-subtle p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span>
                  <span className="block font-medium">{payslip.employee.name}</span>
                  <span className="mt-1 block text-neutral-500">
                    {payslip.number} · {formatDate(payslip.payRun.periodStart)} – {formatDate(payslip.payRun.periodEnd)}
                  </span>
                </span>
                <span className="text-lg font-semibold">{formatPrice(payslip.netPay.toString(), "KES")}</span>
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                Gross {formatPrice(payslip.grossPay.toString(), "KES")} · Deductions{" "}
                {formatPrice(totalDeductions.toFixed(2), "KES")}
              </p>
            </li>
          );
        })}
        {payslips.length === 0 && <p className="text-sm text-neutral-500">No payslips yet.</p>}
      </ul>

      <div className="mt-6 hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[720px] text-sm">
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
            {payslips.map((payslip) => {
              const totalDeductions = payslip.deductions.reduce((sum, d) => sum + Number(d.amount), 0);
              return (
                <tr key={payslip.id} className="border-b border-border-subtle/60">
                  <td className="py-2">{payslip.number}</td>
                  <td className="py-2">{payslip.employee.name}</td>
                  <td className="py-2">
                    {formatDate(payslip.payRun.periodStart)} – {formatDate(payslip.payRun.periodEnd)}
                  </td>
                  <td className="py-2 text-right">{formatPrice(payslip.grossPay.toString(), "KES")}</td>
                  <td className="py-2 text-right">{formatPrice(totalDeductions.toFixed(2), "KES")}</td>
                  <td className="py-2 text-right">{formatPrice(payslip.netPay.toString(), "KES")}</td>
                </tr>
              );
            })}
            {payslips.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-neutral-500">
                  No payslips yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
